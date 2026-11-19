import type { FormField, FormSchema, SectionFieldConfig } from './types';

export interface FormSectionPage {
  id: string;
  sectionField: SectionFieldConfig | null;
  title: string;
  description?: string;
  showLine: boolean;
  /** Top-level fields belonging to this section (excluding the section header itself). */
  topLevelFields: FormField[];
  /** All fields belonging to this section, including nested grid children. */
  allFields: FormField[];
}

function generateSectionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `field_section_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `field_section_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Creates a default SectionFieldConfig with a guaranteed title.
 */
export function createSectionField(
  title = 'Section 1',
  customId?: string,
): SectionFieldConfig {
  return {
    id: customId ?? generateSectionId(),
    type: 'section',
    label: title.trim() || 'Section 1',
    helperText: '',
    required: false,
    showLine: true,
  };
}

/**
 * Ensures a FormSchema starts with a leading `section` field so every form
 * defaults to at least one titled section. Returns the original reference if
 * the first top-level field is already a section.
 */
export function ensureLeadingSection(
  schema: FormSchema,
  defaultTitle = 'Section 1',
): FormSchema {
  const firstTopLevel = schema.fields.find((f) => !f.parentGridId);
  if (firstTopLevel?.type === 'section') {
    if (firstTopLevel.label.trim()) {
      return schema;
    }
    return {
      ...schema,
      fields: schema.fields.map((f) =>
        f.id === firstTopLevel.id ? { ...f, label: defaultTitle } : f,
      ),
    };
  }

  const leadingSection = createSectionField(defaultTitle);
  return {
    ...schema,
    fields: [leadingSection, ...schema.fields],
  };
}

/**
 * Partitions a flat `FormField[]` AST into ordered section pages.
 * Each `type: 'section'` field starts a new page; any legacy leading fields
 * before the first section (or an empty form) are grouped into a default "Section 1" page.
 */
export function partitionFieldsIntoSections(
  fields: FormField[],
): FormSectionPage[] {
  const topLevel = fields.filter((f) => !f.parentGridId);
  const gridChildrenByGridId = new Map<string, FormField[]>();

  for (const field of fields) {
    if (field.parentGridId) {
      const existing = gridChildrenByGridId.get(field.parentGridId);
      if (existing) {
        existing.push(field);
      } else {
        gridChildrenByGridId.set(field.parentGridId, [field]);
      }
    }
  }

  const pages: FormSectionPage[] = [];
  let currentPage: FormSectionPage | null = null;

  const ensureFallbackPage = (): FormSectionPage => {
    if (!currentPage) {
      currentPage = {
        id: 'section_default_1',
        sectionField: null,
        title: 'Section 1',
        description: undefined,
        showLine: true,
        topLevelFields: [],
        allFields: [],
      };
      pages.push(currentPage);
    }
    return currentPage;
  };

  for (const field of topLevel) {
    if (field.type === 'section') {
      const sectionNumber = pages.length + 1;
      currentPage = {
        id: field.id,
        sectionField: field,
        title: field.label.trim() || `Section ${sectionNumber}`,
        description: field.helperText?.trim() ? field.helperText : undefined,
        showLine: field.showLine !== false,
        topLevelFields: [],
        allFields: [],
      };
      pages.push(currentPage);
      continue;
    }

    const targetPage = ensureFallbackPage();
    targetPage.topLevelFields.push(field);

    if (field.type === 'grid') {
      const children = gridChildrenByGridId.get(field.id) ?? [];
      targetPage.allFields.push(...children);
    } else {
      targetPage.allFields.push(field);
    }
  }

  if (pages.length === 0) {
    return [
      {
        id: 'section_default_1',
        sectionField: null,
        title: 'Section 1',
        description: undefined,
        showLine: true,
        topLevelFields: [],
        allFields: [],
      },
    ];
  }

  return pages;
}
