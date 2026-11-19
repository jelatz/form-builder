import {
  FIELD_TYPES,
  type FieldConfigByType,
  type FieldType,
  type FormField,
} from '../domain/form-schema';
import { createId } from '../shared/lib';
import { checkboxFieldDefinition } from './checkbox-field';
import { dateFieldDefinition } from './date-field';
import { emailFieldDefinition } from './email-field';
import { numberFieldDefinition } from './number-field';
import { radioFieldDefinition } from './radio-field';
import { selectFieldDefinition } from './select-field';
import { textFieldDefinition } from './text-field';
import type {
  AnyFieldDefinition,
  BoundFieldModule,
  FieldDefinition,
  FieldRegistryMap,
  ZohoPaletteCategoryGroup,
} from './types';
import {
  addressFieldDefinition,
  currencyFieldDefinition,
  gridFieldDefinition,
  nameFieldDefinition,
  phoneFieldDefinition,
  sectionFieldDefinition,
  textareaFieldDefinition,
  websiteFieldDefinition,
} from './zoho-fields';

export const FIELD_REGISTRY: FieldRegistryMap = {
  text: textFieldDefinition,
  email: emailFieldDefinition,
  number: numberFieldDefinition,
  select: selectFieldDefinition,
  radio: radioFieldDefinition,
  checkbox: checkboxFieldDefinition,
  date: dateFieldDefinition,
  name: nameFieldDefinition,
  phone: phoneFieldDefinition,
  address: addressFieldDefinition,
  textarea: textareaFieldDefinition,
  website: websiteFieldDefinition,
  currency: currencyFieldDefinition,
  section: sectionFieldDefinition,
  grid: gridFieldDefinition,
};

/**
 * Returns the strongly-typed FieldDefinition for a specific FieldType.
 */
export function getFieldDefinition<T extends FieldType>(
  type: T,
): FieldDefinition<T> {
  return FIELD_REGISTRY[type];
}

/**
 * Returns an ordered array of all registered field definitions for palette rendering.
 */
export function getAllFieldDefinitions(): AnyFieldDefinition[] {
  return FIELD_TYPES.map((type) => FIELD_REGISTRY[type]);
}

/**
 * Creates a fresh default FormField configuration for the given FieldType,
 * optionally merging preset patch properties.
 */
export function createDefaultField<T extends FieldType>(
  type: T,
  customId?: string,
  presetPatch?: Partial<FormField>,
): FieldConfigByType<T> {
  const id = customId ?? createId(`field_${type}`);
  const baseConfig = FIELD_REGISTRY[type].createDefaultConfig(id);
  if (presetPatch) {
    return { ...baseConfig, ...presetPatch, id, type } as FieldConfigByType<T>;
  }
  return baseConfig;
}

/**
 * Binds a discriminated FormField instance to its corresponding FieldDefinition,
 * exposing type-safe `renderRuntime` and `renderInspector` closures so consumer
 * features (`builder-canvas`, `property-inspector`, `form-renderer`) never write
 * `switch (field.type)` chains.
 */
export function bindFieldModule(field: FormField): BoundFieldModule {
  switch (field.type) {
    case 'text':
      return {
        definition: textFieldDefinition,
        renderRuntime: (props) =>
          textFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          textFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'email':
      return {
        definition: emailFieldDefinition,
        renderRuntime: (props) =>
          emailFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          emailFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'number':
      return {
        definition: numberFieldDefinition,
        renderRuntime: (props) =>
          numberFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          numberFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'select':
      return {
        definition: selectFieldDefinition,
        renderRuntime: (props) =>
          selectFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          selectFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'radio':
      return {
        definition: radioFieldDefinition,
        renderRuntime: (props) =>
          radioFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          radioFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'checkbox':
      return {
        definition: checkboxFieldDefinition,
        renderRuntime: (props) =>
          checkboxFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          checkboxFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'date':
      return {
        definition: dateFieldDefinition,
        renderRuntime: (props) =>
          dateFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          dateFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'name':
      return {
        definition: nameFieldDefinition,
        renderRuntime: (props) =>
          nameFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          nameFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'phone':
      return {
        definition: phoneFieldDefinition,
        renderRuntime: (props) =>
          phoneFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          phoneFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'address':
      return {
        definition: addressFieldDefinition,
        renderRuntime: (props) =>
          addressFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          addressFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'textarea':
      return {
        definition: textareaFieldDefinition,
        renderRuntime: (props) =>
          textareaFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          textareaFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'website':
      return {
        definition: websiteFieldDefinition,
        renderRuntime: (props) =>
          websiteFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          websiteFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'currency':
      return {
        definition: currencyFieldDefinition,
        renderRuntime: (props) =>
          currencyFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          currencyFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'section':
      return {
        definition: sectionFieldDefinition,
        renderRuntime: (props) =>
          sectionFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          sectionFieldDefinition.renderInspector({ field, onChange }),
      };
    case 'grid':
      return {
        definition: gridFieldDefinition,
        renderRuntime: (props) =>
          gridFieldDefinition.render({ field, ...props }),
        renderInspector: ({ onChange }) =>
          gridFieldDefinition.renderInspector({ field, onChange }),
      };
  }
}

export const ZOHO_PALETTE_CATEGORIES: ZohoPaletteCategoryGroup[] = [
  // Tab 1: Form Fields
  {
    category: 'Grid',
    tab: 'form_fields',
    tiles: [
      {
        id: 'col_1',
        label: '1-Column',
        type: 'grid',
        tab: 'form_fields',
        category: 'Grid',
        iconType: 'col-1',
        accentColor: 'amber',
        presetPatch: { label: '1-Column', columns: 1 },
      },
      {
        id: 'col_2',
        label: '2-Column',
        type: 'grid',
        tab: 'form_fields',
        category: 'Grid',
        iconType: 'col-2',
        accentColor: 'amber',
        presetPatch: { label: '2-Column', columns: 2 },
      },
      {
        id: 'col_3',
        label: '3-Column',
        type: 'grid',
        tab: 'form_fields',
        category: 'Grid',
        iconType: 'col-3',
        accentColor: 'amber',
        presetPatch: { label: '3-Column', columns: 3 },
      },
      {
        id: 'section',
        label: 'Section',
        type: 'section',
        tab: 'form_fields',
        category: 'Grid',
        iconType: 'section',
        accentColor: 'amber',
        presetPatch: { showLine: true },
      },
    ],
  },
  {
    category: 'Basic Info',
    tab: 'form_fields',
    tiles: [
      {
        id: 'name',
        label: 'Name',
        type: 'name',
        tab: 'form_fields',
        category: 'Basic Info',
        iconType: 'user',
        accentColor: 'emerald',
      },
      {
        id: 'address',
        label: 'Address',
        type: 'address',
        tab: 'form_fields',
        category: 'Basic Info',
        iconType: 'address',
        accentColor: 'emerald',
      },
      {
        id: 'phone',
        label: 'Phone',
        type: 'phone',
        tab: 'form_fields',
        category: 'Basic Info',
        iconType: 'phone',
        accentColor: 'emerald',
      },
      {
        id: 'email',
        label: 'Email',
        type: 'email',
        tab: 'form_fields',
        category: 'Basic Info',
        iconType: 'email',
        accentColor: 'emerald',
      },
      {
        id: 'website',
        label: 'Website',
        type: 'website',
        tab: 'form_fields',
        category: 'Basic Info',
        iconType: 'globe',
        accentColor: 'emerald',
      },
      {
        id: 'geocomplete',
        label: 'GeoComplete',
        type: 'address',
        tab: 'form_fields',
        category: 'Basic Info',
        iconType: 'map-pin',
        accentColor: 'emerald',
        presetPatch: {
          label: 'Location (GeoComplete)',
          helperText: 'Auto-completed address',
        },
      },
    ],
  },
  {
    category: 'Textbox',
    tab: 'form_fields',
    tiles: [
      {
        id: 'single_line',
        label: 'Single Line',
        type: 'text',
        tab: 'form_fields',
        category: 'Textbox',
        iconType: 'text-single',
        accentColor: 'blue',
        presetPatch: { label: 'Single Line' },
      },
      {
        id: 'multi_line',
        label: 'Multi Line',
        type: 'textarea',
        tab: 'form_fields',
        category: 'Textbox',
        iconType: 'text-multi',
        accentColor: 'blue',
      },
      {
        id: 'regex',
        label: 'Regex',
        type: 'text',
        tab: 'form_fields',
        category: 'Textbox',
        iconType: 'regex',
        accentColor: 'blue',
        presetPatch: {
          label: 'Regex Field',
          helperText: 'Pattern validated input',
        },
      },
    ],
  },
  {
    category: 'Number',
    tab: 'form_fields',
    tiles: [
      {
        id: 'number',
        label: 'Number',
        type: 'number',
        tab: 'form_fields',
        category: 'Number',
        iconType: 'number',
        accentColor: 'violet',
      },
      {
        id: 'decimal',
        label: 'Decimal',
        type: 'number',
        tab: 'form_fields',
        category: 'Number',
        iconType: 'decimal',
        accentColor: 'violet',
        presetPatch: { label: 'Decimal', step: 0.01 },
      },
      {
        id: 'formula',
        label: 'Formula',
        type: 'number',
        tab: 'form_fields',
        category: 'Number',
        iconType: 'formula',
        accentColor: 'violet',
        presetPatch: {
          label: 'Calculated Formula',
          helperText: 'Auto-calculated value',
        },
      },
      {
        id: 'currency',
        label: 'Currency',
        type: 'currency',
        tab: 'form_fields',
        category: 'Number',
        iconType: 'currency',
        accentColor: 'violet',
      },
    ],
  },
  {
    category: 'Choices',
    tab: 'form_fields',
    tiles: [
      {
        id: 'dropdown',
        label: 'Dropdown',
        type: 'select',
        tab: 'form_fields',
        category: 'Choices',
        iconType: 'dropdown',
        accentColor: 'cyan',
        presetPatch: { label: 'Dropdown', placeholder: '-Select-' },
      },
      {
        id: 'grouped_dropdown',
        label: 'Grouped Dropdown',
        type: 'select',
        tab: 'form_fields',
        category: 'Choices',
        iconType: 'grouped-dropdown',
        accentColor: 'cyan',
        presetPatch: { label: 'Grouped Dropdown', placeholder: '-Select-' },
      },
      {
        id: 'dependent_dropdown',
        label: 'Dependent Dropdown',
        type: 'select',
        tab: 'form_fields',
        category: 'Choices',
        iconType: 'dependent-dropdown',
        accentColor: 'cyan',
        isNew: true,
        presetPatch: { label: 'Dependent Dropdown', placeholder: '-Select-' },
      },
      {
        id: 'radio',
        label: 'Radio',
        type: 'radio',
        tab: 'form_fields',
        category: 'Choices',
        iconType: 'radio',
        accentColor: 'cyan',
      },
      {
        id: 'checkbox',
        label: 'Checkbox',
        type: 'checkbox',
        tab: 'form_fields',
        category: 'Choices',
        iconType: 'checkbox',
        accentColor: 'cyan',
      },
      {
        id: 'multiple_choice',
        label: 'Multiple Choice',
        type: 'select',
        tab: 'form_fields',
        category: 'Choices',
        iconType: 'multi-choice',
        accentColor: 'cyan',
        presetPatch: { label: 'Multiple Choice' },
      },
      {
        id: 'cardview',
        label: 'CardView',
        type: 'radio',
        tab: 'form_fields',
        category: 'Choices',
        iconType: 'cardview',
        accentColor: 'cyan',
        isNew: true,
        presetPatch: { label: 'Card Selection' },
      },
      {
        id: 'image_choices',
        label: 'Image Choices',
        type: 'radio',
        tab: 'form_fields',
        category: 'Choices',
        iconType: 'image-choices',
        accentColor: 'cyan',
        presetPatch: { label: 'Image Choice' },
      },
    ],
  },
  {
    category: 'Date & Time',
    tab: 'form_fields',
    tiles: [
      {
        id: 'date',
        label: 'Date',
        type: 'date',
        tab: 'form_fields',
        category: 'Date & Time',
        iconType: 'date',
        accentColor: 'rose',
      },
    ],
  },

  // Tab 2: Smart Fields
  {
    category: 'Smart Capture',
    tab: 'smart_fields',
    tiles: [
      {
        id: 'smart_confirm_email',
        label: 'Confirm Email',
        type: 'email',
        tab: 'smart_fields',
        category: 'Smart Capture',
        iconType: 'email',
        accentColor: 'emerald',
        isNew: true,
        presetPatch: {
          label: 'Relationship Owner',
          required: true,
          confirmEmail: true,
        },
      },
      {
        id: 'smart_referral_email',
        label: 'Referral Email',
        type: 'email',
        tab: 'smart_fields',
        category: 'Smart Capture',
        iconType: 'email',
        accentColor: 'blue',
        presetPatch: {
          label: 'Referred By',
          showDividerAbove: true,
        },
      },
      {
        id: 'smart_onboarding_section',
        label: 'Onboarding Section',
        type: 'section',
        tab: 'smart_fields',
        category: 'Smart Capture',
        iconType: 'col-1',
        accentColor: 'amber',
        presetPatch: {
          label: 'Contact Information',
          showLine: false,
        },
      },
    ],
  },
];

export type {
  AnyFieldDefinition,
  BoundFieldModule,
  FieldDefinition,
  FieldInspectorProps,
  FieldRegistryMap,
  FieldRenderProps,
  ZohoPaletteCategoryGroup,
  ZohoPaletteTab,
  ZohoPaletteTile,
} from './types';

export { FieldLayoutProvider } from './field-frame';
