import { FunctionDeclaration } from './shamela.tools';

/**
 * أدوات منصة تراث الحصرية (Turath MCP Tools)
 * معزولة تماماً عن أدوات المكتبة الشاملة
 */
export const TURATH_TOOLS: FunctionDeclaration[] = [
  {
    name: 'search_turath',
    description:
      'البحث في نصوص ومخطوطات منصة تراث الإسلامية الموثقة عن كتب ونصوص تراثية قديمة ونادرة.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'نص البحث أو اسم المخطوط أو المؤلف في منصة تراث',
        },
        category: {
          type: 'string',
          description: 'تصنيف المخطوط (اختياري مثل: حديث، فقه، لغة، تراجم، تاريخ)',
        },
        century: {
          type: 'string',
          description: 'القرن الهجري للمؤلف (اختياري مثل: القرن الثالث، القرن الخامس)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_turath_page',
    description:
      'جلب صفحة أو لوحة محددة من مخطوط أو كتاب تراثي موثق مع رقم اللوحة/الصفحة والنسخة الخطية.',
    parameters: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'معرف الوثيقة أو اسم المخطوط التراثي',
        },
        pageNumber: {
          type: 'number',
          description: 'رقم الصفحة أو اللوحة المراد عرضها',
        },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'turath_manuscript_details',
    description:
      'استخراج بيانات المخطوط التراثي التفصيلية: دار المخطوطات الحافظة، رقم الحفظ، تاريخ النسخ، اسم الناسخ، نوع الخط ونوع الحبر.',
    parameters: {
      type: 'object',
      properties: {
        manuscriptTitle: {
          type: 'string',
          description: 'عنوان المخطوط التراثي',
        },
      },
      required: ['manuscriptTitle'],
    },
  },
];
