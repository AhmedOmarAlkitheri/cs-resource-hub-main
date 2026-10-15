export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * أدوات المكتبة الشاملة الحصرية (Shamela MCP Tools)
 * معزولة تماماً عن أدوات منصة تراث
 */
export const SHAMELA_TOOLS: FunctionDeclaration[] = [
  {
    name: 'shamela_search_pages',
    description:
      'البحث في صفحات وكتب المكتبة الشاملة عن نص معين، مسألة فقهية، أو مصطلح شرعي، واستخراج نصوص الكتب مع التوثيق (اسم الكتاب، المؤلف، الجزء، الصفحة).',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'نص البحث أو الكلمة أو المسألة المراد استخراجها من كتب الشاملة',
        },
        bookName: {
          type: 'string',
          description: 'اسم كتاب محدد للبحث فيه (اختياري مثل: المغني، فتح الباري، المجموع)',
        },
        field: {
          type: 'string',
          description: 'المجال الفقهي أو العقدي أو الأصولي (اختياري مثل: فقه، عقيدة، أصول، تفسير)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'shamela_search_hadith',
    description:
      'البحث وتخريج الأحاديث النبوية الشريفة والآثار في كتب السنة والحديث المعتمدة بالشاملة، مع بيان درجة الحديث وحكم المحدثين والرواة.',
    parameters: {
      type: 'object',
      properties: {
        hadithText: {
          type: 'string',
          description: 'طرف الحديث أو جزء من متنه للبحث عنه وتخريجه',
        },
        narrator: {
          type: 'string',
          description: 'اسم الصحابي أو راوي الحديث (اختياري)',
        },
      },
      required: ['hadithText'],
    },
  },
  {
    name: 'shamela_get_book_info',
    description:
      'جلب بطاقة ومعلومات كتاب معين في المكتبة الشاملة (المؤلف، المحقق، دار النشر، عدد الأجزاء، التصنيف).',
    parameters: {
      type: 'object',
      properties: {
        bookTitle: {
          type: 'string',
          description: 'عنوان الكتاب المراد معرفة بياناته',
        },
      },
      required: ['bookTitle'],
    },
  },
];
