import { Ctx, On, Update } from 'nestjs-telegraf';
import { Context } from 'telegraf';

import {
  BotEventService,
  BotEventType,
} from 'src/bot/services/bot-event.service';

import { AddMaterialHandler } from '../admin/materials/add-material.handler';
import { AddCourseHandler } from '../admin/courses/add-course.handler';
import { EditCourseHandler } from '../admin/courses/edit-course.handler';
import { AddExamHandler } from '../admin/exams/add-exam.handler';
import { PromoteUserHandler } from '../admin/users/promote-user.handler';
import { DemoteAdminHandler } from '../admin/users/demote-user.handler';
import { DeleteUserHandler } from '../admin/users/delete-user.handler';
import { ManagePermissionsHandler } from '../admin/users/manage-permissions.handler';
import { AcademicService } from 'src/academic/services/academic.services';
import { UsersService } from 'src/user/services/user.service';
import { ExternalResourceService } from 'src/external/services/external-resource.service';
import { GeminiMcpService } from 'src/ai/services/gemini-mcp.service';

@Update()
export class CentralTextHandler {
  constructor(
    private readonly botEventService: BotEventService,
    private readonly addCourseHandler: AddCourseHandler,
    private readonly editCourseHandler: EditCourseHandler,
    private readonly addMaterialHandler: AddMaterialHandler,
    private readonly addExamHandler: AddExamHandler,
    private readonly pomoteUserHandler: PromoteUserHandler,
    private readonly demoteAdminHandler: DemoteAdminHandler,
    private readonly deleteUserHandler: DeleteUserHandler,
    private readonly managePermissionsHandler: ManagePermissionsHandler,
    private readonly academicService: AcademicService,
    private readonly usersService: UsersService,
    private readonly externalResourceService: ExternalResourceService,
    private readonly geminiMcpService: GeminiMcpService,
  ) {}

  // ============================================================
  // Text Handler
  // ============================================================

  @On('text')
  async handleText(@Ctx() ctx: Context): Promise<void> {
    console.log('[CentralTextHandler] IN TEXT Handler');

    // ============================================================
    // User ID
    // ============================================================

    const userId = ctx.from?.id;

    if (!userId) {
      console.log('[CentralTextHandler] No userId');
      return;
    }

    // ============================================================
    // التأكد أن الرسالة تحتوي على Text
    // ============================================================

    if (!ctx.message || !('text' in ctx.message)) {
      console.log(
        `[CentralTextHandler] Message does not contain text userId=${userId}`,
      );

      return;
    }

    console.log(
      `[CentralTextHandler] TEXT userId=${userId}:`,
      ctx.message.text,
    );

    // ============================================================
    // الحصول على Event
    // ============================================================

    const event = this.botEventService.get(userId);

    // ============================================================
    // لا توجد عملية قيد التنفيذ
    // ============================================================

    if (!event) {
      console.log(`[CentralTextHandler] NO EVENT userId=${userId}`);

      return;
    }

    // ============================================================
    // Log للحالة الحالية
    // ============================================================

    console.log(
      `[CentralTextHandler] EVENT userId=${userId} event=${event.event}`,
      event.data,
    );

    // ============================================================
    // Routing
    // ============================================================

    switch (event.event) {
      // ==========================================================
      // إضافة كورس
      // ==========================================================

      case BotEventType.WAITING_COURSE_NAME: {
        await this.addCourseHandler.handleCourseName(ctx);
        return;
      }

      // ==========================================================
      // تعديل كورس - اسم الكورس القديم
      // ==========================================================

      case BotEventType.WAITING_EDIT_COURSE_NAME: {
        await this.editCourseHandler.handleCourseName(ctx);
        return;
      }

      // ==========================================================
      // إضافة عنوان ملزمة
      // ==========================================================

      case BotEventType.WAITING_MATERIAL_TITLE: {
        await this.addMaterialHandler.receiveTitle(ctx, ctx.message.text);

        return;
      }

      // ==========================================================
      // إضافة تصنيف خارجي
      // ==========================================================

      case BotEventType.WAITING_EXTERNAL_CATEGORY_NAME: {
        const categoryName = ctx.message.text.trim();

        // --------------------------------------------------------
        // التحقق من الاسم
        // --------------------------------------------------------

        if (!categoryName) {
          await ctx.reply('❌ اسم التصنيف لا يمكن أن يكون فارغًا.');

          return;
        }

        // --------------------------------------------------------
        // Parent ID
        // --------------------------------------------------------

        const parentId =
          typeof event.data?.parentId === 'number'
            ? event.data.parentId
            : undefined;

        // --------------------------------------------------------
        // إنشاء التصنيف
        // --------------------------------------------------------

        await this.externalResourceService.createCategory({
          name: categoryName,

          ...(parentId !== undefined
            ? {
                parent: {
                  connect: {
                    id: parentId,
                  },
                },
              }
            : {}),
        });

        // --------------------------------------------------------
        // حذف Event
        // --------------------------------------------------------

        this.botEventService.delete(userId);

        // --------------------------------------------------------
        // الرد
        // --------------------------------------------------------

        await ctx.reply(
          `✅ <b>تمت إضافة التصنيف بنجاح</b>\n\n` +
            `📁 التصنيف: <b>${categoryName}</b>`,
          {
            parse_mode: 'HTML',
          },
        );

        return;
      }

      // ==========================================================
      // إضافة المصدر الخارجي - الكابشن
      // ==========================================================
      //
      // التدفق:
      //
      // 1. اختيار التصنيف
      // 2. إرسال PDF
      // 3. UploadDocumentHandler يحفظ بيانات الملف
      // 4. يتحول Event إلى:
      //
      //    WAITING_EXTERNAL_RESOURCE_CAPTION
      //
      // 5. المستخدم يرسل الكابشن
      // 6. هنا يتم إنشاء ExternalResource
      //
      // ==========================================================

      case BotEventType.WAITING_EXTERNAL_RESOURCE_CAPTION: {
        const caption = ctx.message.text.trim();

        console.log(
          `[CentralTextHandler] EXTERNAL RESOURCE CAPTION userId=${userId}:`,
          caption,
        );

        // --------------------------------------------------------
        // التحقق من الكابشن
        // --------------------------------------------------------

        if (!caption) {
          await ctx.reply(
            '❌ الكابشن لا يمكن أن يكون فارغًا.\n\n' +
              'أرسل وصفًا أو عنوانًا للمصدر.',
          );

          return;
        }

        // --------------------------------------------------------
        // Category ID
        // --------------------------------------------------------

        const categoryId =
          typeof event.data?.categoryId === 'number'
            ? event.data.categoryId
            : undefined;

        // --------------------------------------------------------
        // Telegram Chat ID
        // --------------------------------------------------------

        const telegramChatId =
          typeof event.data?.telegramChatId === 'string'
            ? event.data.telegramChatId
            : undefined;

        // --------------------------------------------------------
        // Telegram Message ID
        // --------------------------------------------------------

        const telegramMessageId =
          typeof event.data?.telegramMessageId === 'number'
            ? event.data.telegramMessageId
            : undefined;

        // --------------------------------------------------------
        // Telegram File ID
        // --------------------------------------------------------

        const telegramFileId =
          typeof event.data?.telegramFileId === 'string'
            ? event.data.telegramFileId
            : undefined;

        // --------------------------------------------------------
        // عنوان الملف
        // --------------------------------------------------------

        const title =
          typeof event.data?.title === 'string' && event.data.title.trim()
            ? event.data.title.trim()
            : 'مصدر خارجي';

        // --------------------------------------------------------
        // Log البيانات
        // --------------------------------------------------------

        console.log('[CentralTextHandler] EXTERNAL RESOURCE DATA', {
          categoryId,
          title,
          caption,
          telegramChatId,
          telegramMessageId,
          telegramFileId,
        });

        // --------------------------------------------------------
        // التحقق من البيانات
        // --------------------------------------------------------

        if (
          categoryId === undefined ||
          !telegramChatId ||
          telegramMessageId === undefined ||
          !telegramFileId
        ) {
          console.error(
            '[CentralTextHandler] EXTERNAL RESOURCE DATA INVALID',
            event.data,
          );

          await ctx.reply(
            '❌ بيانات المصدر غير مكتملة.\n\n' +
              'أعد عملية إضافة المصدر من جديد.',
          );

          this.botEventService.delete(userId);

          return;
        }

        // --------------------------------------------------------
        // إنشاء المصدر
        // --------------------------------------------------------

        let finalChatId = telegramChatId;
        let finalMessageId = telegramMessageId;

        const storageChannel = process.env.MATERIAL_STORAGE_CHANNEL_ID;
        if (storageChannel) {
          try {
            const copied = await ctx.telegram.copyMessage(
              storageChannel,
              telegramChatId,
              telegramMessageId,
              {
                caption: `📄 <b>${title}</b>\n\n${caption}`,
                parse_mode: 'HTML',
              },
            );
            finalChatId = storageChannel;
            finalMessageId = copied.message_id;
          } catch (err) {
            console.warn(
              '[CentralTextHandler] Failed to copy external resource to storage channel, saving original:',
              err,
            );
          }
        }

        await this.externalResourceService.createResource({
          categoryId,
          title,
          caption,
          telegramChatId: finalChatId,
          telegramMessageId: finalMessageId,
          telegramFileId,
        });

        // --------------------------------------------------------
        // حذف Event
        // --------------------------------------------------------

        this.botEventService.delete(userId);

        // --------------------------------------------------------
        // رسالة النجاح
        // --------------------------------------------------------

        await ctx.reply(
          '✅ <b>تمت إضافة المصدر بنجاح</b>\n\n' +
            `📄 الملف: <b>${title}</b>\n` +
            `📝 الكابشن: <b>${caption}</b>`,
          {
            parse_mode: 'HTML',
          },
        );

        console.log(
          `[CentralTextHandler] EXTERNAL RESOURCE CREATED userId=${userId}`,
        );

        return;
      }

      // ==========================================================
      // إضافة عنوان اختبار
      // ==========================================================

      case BotEventType.WAITING_EXAM_TITLE: {
        await this.addExamHandler.receiveTitle(ctx, ctx.message.text);

        return;
      }

      // ==========================================================
      // تعديل كورس - الاسم الجديد
      // ==========================================================

      case BotEventType.WAITING_EDIT_COURSE_NEW_NAME: {
        await this.editCourseHandler.handleNewCourseName(ctx);

        return;
      }

      // ==========================================================
      // ترقية مستخدم إلى Admin
      // ==========================================================

      case BotEventType.WAITING_PROMOTE_USER: {
        await this.pomoteUserHandler.handleUsername(ctx);

        return;
      }

      // ==========================================================
      // إزالة صلاحية Admin
      // ==========================================================

      case BotEventType.WAITING_DEMOTE_ADMIN: {
        await this.demoteAdminHandler.handleUsername(ctx);

        return;
      }

      // ==========================================================
      // حذف مستخدم
      // ==========================================================

      case BotEventType.WAITING_DELETE_USER: {
        await this.deleteUserHandler.handleInput(ctx);

        return;
      }

      // ==========================================================
      // إدارة الصلاحيات المخصصة - البحث عن مستخدم
      // ==========================================================

      case BotEventType.WAITING_USER_PERMISSIONS_SEARCH: {
        const input = ctx.message.text.trim();
        const cleanUsername = input.startsWith('@') ? input.slice(1) : input;
        const allUsers = await this.usersService.getAll();
        const target = allUsers.find(
          (u) =>
            u.telegramId === input ||
            (u.username && u.username.toLowerCase() === cleanUsername.toLowerCase()),
        );

        if (!target) {
          await ctx.reply(
            '❌ لم يتم العثور على المستخدم.\n\n' +
              'تأكد أن المستخدم بدأ محادثة مع البوت مسبقاً، ثم أعد إرسال معرفه الصحيح.',
          );
          return;
        }

        this.botEventService.delete(userId);
        await this.managePermissionsHandler.showPermissionsCard(ctx, target);
        return;
      }

      // ==========================================================
      // إضافة عام دراسي جديد
      // ==========================================================

      case BotEventType.WAITING_STRUCTURE_YEAR_INPUT: {
        const text = ctx.message.text.trim();
        const match = text.match(/(\d{4})\s*[-/]\s*(\d{4})/);

        if (!match) {
          await ctx.reply(
            '❌ صيغة العام الدراسي غير صحيحة.\n\n' +
              'يرجى إرسال العام بصيغة: <code>2025-2026</code> أو <code>2026-2027</code>',
            { parse_mode: 'HTML' },
          );
          return;
        }

        const startYear = Number(match[1]);
        const endYear = Number(match[2]);

        try {
          await this.academicService.createAcademicYear(startYear, endYear);
          this.botEventService.delete(userId);
          await ctx.reply(
            `✅ <b>تمت إضافة العام الدراسي (${startYear} - ${endYear}) بنجاح!</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '📅 قائمة الأعوام الدراسية', callback_data: 'struct_years' }],
                  [{ text: '🏛️ إدارة الهيكل الجامعي', callback_data: 'admin_structure' }],
                ],
              },
            },
          );
        } catch (error: any) {
          await ctx.reply('⚠️ تعذر إضافة العام الدراسي (قد يكون مسجلاً مسبقاً).');
        }
        return;
      }

      // ==========================================================
      // إضافة كلية / قسم جديد
      // ==========================================================

      case BotEventType.WAITING_STRUCTURE_DEPARTMENT_INPUT: {
        const name = ctx.message.text.trim();
        if (!name || name.length < 2) {
          await ctx.reply('❌ يرجى كتابة اسم صحيح للكلية أو القسم.');
          return;
        }

        try {
          await this.academicService.createDepartment(name);
          this.botEventService.delete(userId);
          await ctx.reply(
            `✅ <b>تمت إضافة الكلية (${name}) بنجاح!</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🏫 قائمة الكليات', callback_data: 'struct_departments' }],
                  [{ text: '🏛️ إدارة الهيكل الجامعي', callback_data: 'admin_structure' }],
                ],
              },
            },
          );
        } catch (error) {
          await ctx.reply('⚠️ تعذر إضافة الكلية (قد تكون مسجلة مسبقاً بنفس الاسم).');
        }
        return;
      }

      // ==========================================================
      // إضافة تخصص جديد
      // ==========================================================

      case BotEventType.WAITING_STRUCTURE_TRACK_INPUT: {
        const name = ctx.message.text.trim();
        const deptId = Number(event.data?.departmentId);

        if (!name || !deptId) {
          await ctx.reply('❌ يرجى كتابة اسم صحيح للتخصص.');
          return;
        }

        try {
          await this.academicService.createTrack(deptId, name);
          this.botEventService.delete(userId);
          await ctx.reply(
            `✅ <b>تمت إضافة التخصص (${name}) بنجاح!</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🛤️ تخصصات الكلية', callback_data: `struct_tracks_dept/${deptId}` }],
                  [{ text: '🏛️ إدارة الهيكل الجامعي', callback_data: 'admin_structure' }],
                ],
              },
            },
          );
        } catch (error) {
          await ctx.reply('⚠️ تعذر إضافة التخصص (قد يكون مسجلاً مسبقاً).');
        }
        return;
      }

      // ==========================================================
      // إضافة مستوى دراسي جديد
      // ==========================================================

      case BotEventType.WAITING_STRUCTURE_LEVEL_INPUT: {
        const text = ctx.message.text.trim();
        const numMatch = text.match(/^(\d+)[\s,-]*(.*)$/);

        if (!numMatch) {
          await ctx.reply(
            '❌ صيغة المستوى غير صحيحة.\n\n' +
              'يرجى كتابة رقم المستوى واسمه:\n' +
              'مثال: <code>5 المستوى الخامس</code> أو <code>5, المستوى الخامس</code>',
            { parse_mode: 'HTML' },
          );
          return;
        }

        const number = Number(numMatch[1]);
        const name = numMatch[2].trim() || `المستوى ${number}`;

        try {
          await this.academicService.createLevel(number, name);
          this.botEventService.delete(userId);
          await ctx.reply(
            `✅ <b>تمت إضافة (${name}) برقم (#${number}) بنجاح!</b>`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🎓 قائمة المستويات', callback_data: 'struct_levels' }],
                  [{ text: '🏛️ إدارة الهيكل الجامعي', callback_data: 'admin_structure' }],
                ],
              },
            },
          );
        } catch (error) {
          await ctx.reply('⚠️ تعذر إضافة المستوى (قد يكون رقم المستوى مسجلاً مسبقاً).');
        }
        return;
      }

      // ==========================================================
      // محادثة باحث المكتبة الشاملة الذكي
      // ==========================================================

      case BotEventType.CHATTING_SHAMELA: {
        const queryText = ctx.message.text.trim();
        if (queryText === '/cancel' || queryText === 'خروج') {
          this.geminiMcpService.clearSession(userId);
          this.botEventService.delete(userId);
          await ctx.reply('✅ تم إنهاء محادثة باحث المكتبة الشاملة والعودة.');
          return;
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;

        // تنفيذ البحث في الخلفية لمنع أي Timeout نهائياً
        void (async () => {
          let statusMsgId: number | null = null;
          try {
            await ctx.sendChatAction('typing');
            const statusMsg = await ctx.reply(
              '🔍 <b>جاري البحث في مصادر المكتبة الشاملة وتخريج المسألة بالأدلة...</b>',
              { parse_mode: 'HTML' },
            );
            statusMsgId = statusMsg.message_id;
          } catch (e) {
            // ignore
          }

          const reply = await this.geminiMcpService.chat(
            userId,
            queryText,
            'SHAMELA',
          );

          if (statusMsgId) {
            try {
              await ctx.telegram.deleteMessage(chatId, statusMsgId);
            } catch (e) {}
          }

          const extraKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '❌ إنهاء المحادثة والعودة للمصادر',
                    callback_data: 'ai_chat_exit',
                  },
                ],
              ],
            },
          };

          try {
            await ctx.telegram.sendMessage(chatId, reply, {
              parse_mode: 'Markdown',
              ...extraKeyboard,
            });
          } catch (err) {
            await ctx.telegram.sendMessage(chatId, reply, extraKeyboard);
          }
        })();

        return;
      }

      // ==========================================================
      // محادثة باحث منصة تراث للمخطوطات
      // ==========================================================

      case BotEventType.CHATTING_TURATH: {
        const queryText = ctx.message.text.trim();
        if (queryText === '/cancel' || queryText === 'خروج') {
          this.geminiMcpService.clearSession(userId);
          this.botEventService.delete(userId);
          await ctx.reply('✅ تم إنهاء محادثة باحث منصة تراث والعودة.');
          return;
        }

        const chatId = ctx.chat?.id;
        if (!chatId) return;

        // تنفيذ البحث في الخلفية لمنع أي Timeout نهائياً
        void (async () => {
          let statusMsgId: number | null = null;
          try {
            await ctx.sendChatAction('typing');
            const statusMsg = await ctx.reply(
              '📜 <b>جاري البحث في خزائن منصة تراث وتوثيق المخطوطات...</b>',
              { parse_mode: 'HTML' },
            );
            statusMsgId = statusMsg.message_id;
          } catch (e) {
            // ignore
          }

          const reply = await this.geminiMcpService.chat(
            userId,
            queryText,
            'TURATH',
          );

          if (statusMsgId) {
            try {
              await ctx.telegram.deleteMessage(chatId, statusMsgId);
            } catch (e) {}
          }

          const extraKeyboard = {
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '❌ إنهاء المحادثة والعودة للمصادر',
                    callback_data: 'ai_chat_exit',
                  },
                ],
              ],
            },
          };

          try {
            await ctx.telegram.sendMessage(chatId, reply, {
              parse_mode: 'Markdown',
              ...extraKeyboard,
            });
          } catch (err) {
            await ctx.telegram.sendMessage(chatId, reply, extraKeyboard);
          }
        })();

        return;
      }

      // ==========================================================
      // Default
      // ==========================================================

      default: {
        console.log(
          `[CentralTextHandler] Unhandled event=${event.event} userId=${userId}`,
        );

        return;
      }
    }
  }
}
