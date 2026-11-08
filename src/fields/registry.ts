import type { ReactNode } from 'react';
import type { FieldType, FormField } from '../domain/form-schema/index.ts';
import type { FieldInspectorProps, FieldRenderProps } from './types.ts';
import { textFieldDefinition } from './text-field.tsx';
import { emailFieldDefinition } from './email-field.tsx';
import { phoneFieldDefinition } from './phone-field.tsx';
import { numberFieldDefinition } from './number-field.tsx';
import { textareaFieldDefinition } from './textarea-field.tsx';
import { selectFieldDefinition } from './select-field.tsx';
import { radioFieldDefinition } from './radio-field.tsx';
import { checkboxFieldDefinition } from './checkbox-field.tsx';
import { dateFieldDefinition } from './date-field.tsx';
import { hiddenFieldDefinition } from './hidden-field.tsx';
import { sectionFieldDefinition } from './section-field.tsx';

export const FIELD_TYPES = [
  'text',
  'email',
  'phone',
  'number',
  'textarea',
  'select',
  'radio',
  'checkbox',
  'date',
  'hidden',
  'section',
] as const;

export interface FieldCatalogItem {
  type: FieldType;
  paletteLabel: string;
  description: string;
  badge: string;
}

export const FIELD_DEFINITIONS = {
  text: textFieldDefinition,
  email: emailFieldDefinition,
  phone: phoneFieldDefinition,
  number: numberFieldDefinition,
  textarea: textareaFieldDefinition,
  select: selectFieldDefinition,
  radio: radioFieldDefinition,
  checkbox: checkboxFieldDefinition,
  date: dateFieldDefinition,
  hidden: hiddenFieldDefinition,
  section: sectionFieldDefinition,
} as const;

export function getFieldDefinition(type: 'text'): typeof textFieldDefinition;
export function getFieldDefinition(type: 'email'): typeof emailFieldDefinition;
export function getFieldDefinition(type: 'phone'): typeof phoneFieldDefinition;
export function getFieldDefinition(type: 'number'): typeof numberFieldDefinition;
export function getFieldDefinition(type: 'textarea'): typeof textareaFieldDefinition;
export function getFieldDefinition(type: 'select'): typeof selectFieldDefinition;
export function getFieldDefinition(type: 'radio'): typeof radioFieldDefinition;
export function getFieldDefinition(type: 'checkbox'): typeof checkboxFieldDefinition;
export function getFieldDefinition(type: 'date'): typeof dateFieldDefinition;
export function getFieldDefinition(type: 'hidden'): typeof hiddenFieldDefinition;
export function getFieldDefinition(type: 'section'): typeof sectionFieldDefinition;
export function getFieldDefinition(type: FieldType): (typeof FIELD_DEFINITIONS)[FieldType];
export function getFieldDefinition(type: FieldType) {
  return FIELD_DEFINITIONS[type];
}

export function getFieldCatalog(): FieldCatalogItem[] {
  return FIELD_TYPES.map((type) => {
    const def = FIELD_DEFINITIONS[type];
    return {
      type: def.type,
      paletteLabel: def.paletteLabel,
      description: def.description,
      badge: def.badge,
    };
  });
}

export function createFieldByType(type: FieldType): FormField {
  return FIELD_DEFINITIONS[type].createDefault();
}

export function renderFieldInput(props: FieldRenderProps<FormField>): ReactNode {
  switch (props.field.type) {
    case 'text':
      return textFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'email':
      return emailFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'phone':
      return phoneFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'number':
      return numberFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'textarea':
      return textareaFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'select':
      return selectFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'radio':
      return radioFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'checkbox':
      return checkboxFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'date':
      return dateFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'hidden':
      return hiddenFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
    case 'section':
      return sectionFieldDefinition.renderInput({
        ...props,
        field: props.field,
      });
  }
}

export function renderFieldInspector(props: FieldInspectorProps<FormField>): ReactNode {
  switch (props.field.type) {
    case 'text':
      return textFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'email':
      return emailFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'phone':
      return phoneFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'number':
      return numberFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'textarea':
      return textareaFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'select':
      return selectFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'radio':
      return radioFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'checkbox':
      return checkboxFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'date':
      return dateFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'hidden':
      return hiddenFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
    case 'section':
      return sectionFieldDefinition.renderInspector({
        field: props.field,
        onChange: props.onChange,
      });
  }
}

export {
  checkboxFieldDefinition,
  dateFieldDefinition,
  emailFieldDefinition,
  hiddenFieldDefinition,
  numberFieldDefinition,
  phoneFieldDefinition,
  radioFieldDefinition,
  sectionFieldDefinition,
  selectFieldDefinition,
  textFieldDefinition,
  textareaFieldDefinition,
};
