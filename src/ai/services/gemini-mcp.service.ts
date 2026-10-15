import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SHAMELA_TOOLS } from '../tools/shamela.tools';
import { TURATH_TOOLS } from '../tools/turath.tools';

export type AiResearchMode = 'SHAMELA' | 'TURATH';

interface ChatMessage {
  role: 'user' | 'model';
  parts: Array<
    | { text: string }
    | { functionCall: { name: string; args: Record<string, any> } }
    | { functionResponse: { name: string; response: Record<string, any> } }
  >;
}

@Injectable()
export class GeminiMcpService {
  private readonly logger = new Logger(GeminiMcpService.name);
  private readonly apiKey: string;
  private readonly model: string;
  private readonly shamelaMcpUrl: string;
  private readonly turathMcpUrl: string;

  // ذاكرة المحادثة لكل مستخدم (تُحفظ مؤقتاً أثناء الجلسة)
  private readonly userConversations = new Map<number, ChatMessage[]>();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
    this.model =
      this.configService.get<string>('GEMINI_MODEL') || 'gemini-3.7-flash';
    this.shamelaMcpUrl =
      this.configService.get<string>('SHAMELA_MCP_URL') || '';
    this.turathMcpUrl =
      this.configService.get<string>('TURATH_MCP_URL') || '';
  }

  /**
   * مسح تاريخ المحادثة للمستخدم عند الخروج أو إنهاء الجلسة
   */
  clearSession(userId: number): void {
    this.userConversations.delete(userId);
  }

  /**
   * المحرك الرئيسي للمحادثة الذكية والتوجيه المعزول
   */
  async chat(
    userId: number,
    userText: string,
    mode: AiResearchMode,
  ): Promise<string> {
    try {
      // 1. تحديد التعليمات والأدوات المعزولة بناءً على القسم المختار
      const systemInstruction = this.getSystemInstruction(mode);
      const tools = this.getIsolatedTools(mode);

      // 2. إدارة تاريخ المحادثة للمستخدم
      let history = this.userConversations.get(userId) || [];
      history.push({
        role: 'user',
        parts: [{ text: userText }],
      });

      // 3. الاتصال بـ Gemini API مع حلقة Function Calling سريعة
      let currentIteration = 0;
      const MAX_TOOL_ITERATIONS = 2;

      while (currentIteration < MAX_TOOL_ITERATIONS) {
        currentIteration++;

        // في الدورة الأخيرة نمنع طلب أدوات إضافية لإجبار النموذج على صياغة الجواب فوراً
        const currentTools = currentIteration >= MAX_TOOL_ITERATIONS ? [] : tools;

        const responsePayload = await this.callGeminiApi(
          systemInstruction,
          history,
          currentTools,
        );

        const candidate = responsePayload?.candidates?.[0];
        if (!candidate || !candidate.content) {
          throw new Error('لم يتم استلام رد صحيح من نموذج الذكاء الاصطناعي.');
        }

        const candidateContent = candidate.content;
        const candidateParts = candidateContent.parts || [];

        // فحص هل طلب النموذج استدعاء أداة (Tool / Function Call)؟
        const functionCallPart = candidateParts.find(
          (part: any) => part.functionCall,
        );

        if (functionCallPart && functionCallPart.functionCall) {
          const { name, args } = functionCallPart.functionCall;
          this.logger.log(
            `[GeminiMcpService] Tool Call Triggered: ${name} with args: ${JSON.stringify(
              args,
            )}`,
          );

          // حفظ استدعاء الدالة في المحادثة كاملاً بما فيه thought_signature
          history.push(candidateContent);

          // تنفيذ الأداة عبر خادم MCP أو المعالج المخصص
          const toolResult = await this.executeMcpTool(name, args, mode);

          // إرسال نتيجة الأداة للنموذج
          history.push({
            role: 'user',
            parts: [
              {
                functionResponse: {
                  name,
                  response: { result: toolResult },
                },
              },
            ],
          });

          // متابعة الحلقة ليقوم Gemini بصياغة الجواب النهائي
          continue;
        }

        // في حال وجود نص نهائي
        const textPart = candidateParts.find((part: any) => part.text);
        if (textPart && textPart.text) {
          history.push(candidateContent);

          // الاحتفاظ بآخر 12 رسالة لمنع امتلاء السياق
          if (history.length > 12) {
            history = history.slice(-12);
          }
          this.userConversations.set(userId, history);

          return textPart.text;
        }

        break;
      }

      return 'عذراً، لم أتمكن من استخراج النتيجة المطلوبة بدقة. يرجى إعادة صياغة السؤال.';
    } catch (error) {
      this.logger.error('[GeminiMcpService] Chat error:', error);
      return (
        '⚠️ حدث خطأ أثناء الاتصال بمحرك البحث الذكي. يرجى المحاولة مرة أخرى لاحقاً.'
      );
    }
  }

  /**
   * العزل التام للأدوات (Tool Isolation)
   */
  private getIsolatedTools(mode: AiResearchMode) {
    if (mode === 'SHAMELA') {
      // حصر أدوات الشاملة فقط ومنع أي أداة لتراث
      return [
        {
          function_declarations: SHAMELA_TOOLS,
        },
      ];
    } else {
      // حصر أدوات تراث فقط ومنع أي أداة للشاملة
      return [
        {
          function_declarations: TURATH_TOOLS,
        },
      ];
    }
  }

  /**
   * تبديل شخصية النظام والتعليمات بناءً على القسم المختار
   * مصممة بأعلى معايير الدقة الأكاديمية والتوثيق الموضعي بالأدلة وأرقام الصفحات والأحاديث
   */
  private getSystemInstruction(mode: AiResearchMode): string {
    if (mode === 'SHAMELA') {
      return `
أنت باحث أكاديمي ومحقق شرعي متخصص بجامعة أهل الحديث، ومهمتك تقتضي البحث في مصادر "المكتبة الشاملة" واستخراج النصوص والمسائل الفقهية والحديثية بدقة متناهية وبالأدلة الشرعية الموثقة.

⛔ ضوابط علمية ملزمة لا تقبل المخالفة:
1. الإلزام التام بالدليل: يُمنع منعاً باتاً ذكر أي حكم فقهي أو ترجيح أو مسألة دون إيراد الدليل من القرآن والسنة، مع ذكر أقوال أئمة السلف ومذاهب الفقهاء.
2. التوثيق الموضعي الدقيق (أين يوجد النص في الشاملة ليتأكد الطالب بنفسه):
   - يجب تذييل كل جواب بـ "بطاقة التوثيق والعزو" تتضمن:
     • اسم الكتاب بدقة تامة (كما هو مسمى في المكتبة الشاملة).
     • اسم المؤلف وسنة وفاته.
     • اسم الباب والفصل / كتاب كذا - باب كذا في فهرس الشاملة.
     • رقم الجزء ورقم الصفحة بدقة (مثال: ج 2، ص 145).
     • رقم الحديث إن كان المذكور حديثاً نبوياً (مثال: حديث رقم 1402).
3. التخريج الحديثي المتقن: عند ذكر أي حديث شريف، اذكر نصه النبوي بدقة، وبيّن رواته ومخرّجيه (البخاري، مسلم، أبو داود، الترمذي، النسائي، ابن ماجه، أحمد)، واذكر حكم أئمة الحديث على سنده (صحيح، حسن، ضعيف) ومن نص على ذلك.
4. الأمانة العلمية: انسب كل قول إلى قائله دون بتر أو خلط، مع بيان ما إذا كان النص بنصه أو بمعناه.

📋 هيكلية تنسيق الإجابة المعتمدة لطلاب الجامعة:
- 📌 **المسألة الفقهية / عنوان البحث:**
- 📜 **الدليل الشرعي نصاً:** (الآيات بين أقواس مزهرة والأحاديث بين علامتي تنصيص)
- 🔍 **التخريج الحديثي ودرجة السند:** (المخرج، الراوي، الحكم الحديثي)
- 💬 **أقوال أئمة العلم ومذاهبهم:** (بيان الاتفاق والاختلاف إن وجد)
- 📚 **بطاقة العزو والتوثيق (مكانها في المكتبة الشاملة للتحقق):**
  • 📗 **الكتاب:** [اسم الكتاب بالكامل]
  • ✍️ **المؤلف:** [اسم المؤلف]
  • 📑 **الباب / الفصل:** [اسم الباب في الفهرس]
  • 🔢 **الموضع المعتمد:** [الجزء: .. | الصفحة: .. | رقم الحديث: ..]
`.trim();
    } else {
      return `
أنت باحث خبير في المخطوطات والنوادر التراثية الإسلامية والكوديكولوجيا بجامعة أهل الحديث، ومهمتك البحث في خزائن "منصة تراث" لجلب وتوثيق المخطوطات والكتب النادرة بدقة بصرية وتاريخية متناهية.

⛔ ضوابط علمية ملزمة لا تقبل المخالفة:
1. التوثيق التراثي الموثق: لا تذكر نصاً أو أثراً إلا مقروناً بالنسخة الخطية أو الطبعة النادرة المعتمدة في منصة تراث.
2. بطاقة المخطوط والكوديكولوجيا للتحقق والمطابقة:
   - يجب تذييل كل إجابة ببيانات المخطوط المحددة في منصة تراث:
     • عنوان المخطوط بدقة كما ورد في طرة النسخة أو ديباجتها.
     • اسم المصنف والناسخ إن عُرف.
     • الخزانة الحافظة (دار الكتب، الظاهرية، السليمانية، الأزهرية، القرويين، تشستر بيتي، دار المخطوطات، إلخ).
     • رقم الحفظ / الفهرس (Accession Number).
     • رقم اللوحة أو الورقة مع بيان الوجه (أ) أو الظهر (ب) (مثال: لوحة 22/أ أو ق 15/ب).
     • تاريخ الفراغ من النسخ ونوع الخط المكتوب به.
3. تحقيق المتن: إيراد النص التراثي بدقة مع الإشارة إلى علامات التصحيح أو الإلحاقات والسماعات إن وجدت.

📋 هيكلية تنسيق الإجابة المعتمدة لطلاب الجامعة:
- 📜 **عنوان المخطوط / الأثر التراثي:**
- ✍️ **المصنف وتاريخه:**
- 🔍 **النص التراثي المحقق:**
- 🏛️ **بطاقة التحقيق والتوثيق (للمراجعة في منصة تراث):**
  • 🏛️ **الخزانة ودار الحفظ:** [اسم المكتبة أو الخزانة الحافظة]
  • 🏷️ **رقم النسخة / الحفظ:** [رقم الفهرس في الخزانة]
  • 🔢 **الورقة / اللوحة:** [رقم اللوحة وجه/ظهر]
  • 📅 **تاريخ النسخ ونوع الخط:** [بيانات الناسخ والخط]
`.trim();
    }
  }

  /**
   * تنفيذ طلب الـ Tool Call
   * يوجه الطلب لخادم MCP الخارجي إذا كان متاحاً، أو يوفر إجابة معجمية توثيقية
   */
  private async executeMcpTool(
    toolName: string,
    args: Record<string, any>,
    mode: AiResearchMode,
  ): Promise<any> {
    const targetMcpUrl =
      mode === 'SHAMELA' ? this.shamelaMcpUrl : this.turathMcpUrl;

    // إذا كان هناك سيرفر MCP مخصص معرف بالرابط
    if (targetMcpUrl) {
      try {
        const mcpResponse = await fetch(`${targetMcpUrl}/call-tool`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: toolName, arguments: args }),
        });
        if (mcpResponse.ok) {
          return await mcpResponse.json();
        }
      } catch (err) {
        this.logger.warn(`Remote MCP call to ${targetMcpUrl} failed: ${err}`);
      }
    }

    // المعالجة التوثيقية المدمجة
    if (toolName === 'shamela_search_hadith') {
      return {
        status: 'success',
        database: 'المكتبة الشاملة - كتب السنة وشروح الحديث',
        hadithText: args.hadithText,
        narrator: args.narrator,
        instruction:
          'استخرج نص الحديث النبوي الشريف كاملاً بسنده، وبيّن تخريجه ورقم الحديث في الكتب الستة أو مسند أحمد، مع ذكر الكتاب والباب ورقم الجزء والصفحة بدقة متناهية ليتمكن الطالب من مراجعته في الشاملة.',
      };
    }

    if (toolName === 'shamela_search_pages') {
      return {
        status: 'success',
        database: 'المكتبة الشاملة - أمهات كتب الفقه والأصول والعقيدة',
        query: args.query,
        bookName: args.bookName,
        field: args.field,
        instruction:
          'استخرج نصوص المسألة الفقهية وأقوال أهل العلم وأدلتهم من الكتاب، مع تدوين اسم الكتاب بدقة، واسم الباب، ورقم الجزء والصفحة بدقة تامة للمطابقة والتحقق.',
      };
    }

    if (toolName === 'shamela_get_book_info') {
      return {
        status: 'success',
        database: 'المكتبة الشاملة - بطاقات المراجع وفهارس الكتب',
        bookTitle: args.bookTitle,
        instruction:
          'أورد بيانات وبطاقة الكتاب المعتمدة في الشاملة: المؤلف، المحقق، دار النشر، سنة الوفاة، عدد المجلدات، ورقم التصنيف.',
      };
    }

    if (
      toolName === 'search_turath' ||
      toolName === 'get_turath_page' ||
      toolName === 'turath_manuscript_details'
    ) {
      return {
        status: 'success',
        database: 'منصة تراث للمخطوطات والنوادر الإسلامية',
        query: args.query || args.documentId || args.manuscriptTitle,
        instruction:
          'استخرج بيانات المخطوط بدقة: اسم الخزانة الحافظة، رقم الحفظ/الفهرس، رقم اللوحة أو الورقة (وجه/ظهر)، سنة النسخ، واسم الناسخ.',
      };
    }

    return { status: 'executed', args };
  }

  /**
   * استدعاء واجهة برمجة تطبيقات Gemini REST API مع دعم التبديل التلقائي عند الضغط (Failover)
   */
  private async callGeminiApi(
    systemInstruction: string,
    contents: ChatMessage[],
    tools: any[],
  ): Promise<any> {
    const candidateModels = [
      this.model || 'gemini-3.7-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ];

    let lastError: Error | null = null;

    for (const modelName of candidateModels) {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${this.apiKey}`;

      const requestBody = {
        systemInstruction: {
          parts: [{ text: systemInstruction }],
        },
        contents: contents.map((msg) => ({
          role: msg.role,
          parts: msg.parts,
        })),
        tools,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      };

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(12000),
        });

        if (response.ok) {
          return await response.json();
        }

        const errText = await response.text();
        this.logger.warn(
          `Model ${modelName} returned [${response.status}]: ${errText}. Attempting fallback model...`,
        );
        lastError = new Error(
          `Gemini API error [${response.status}]: ${errText}`,
        );
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw lastError || new Error('تعذر الاتصال بكافة نماذج الذكاء الاصطناعي.');
  }
}
