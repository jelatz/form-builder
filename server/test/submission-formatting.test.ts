import assert from 'node:assert/strict';
import test from 'node:test';
import {
  countDataFields,
  type FormField,
  type FormSchema,
  type SubmissionRecord,
} from '../../src/domain/form-schema/types.ts';
import {
  createInitialFormValues,
  parseFormSchemaJson,
  toFieldQueryKey,
} from '../../src/domain/form-schema/validation.ts';
import {
  formatSubmissionValue,
  getSubmissionPreview,
} from '../../src/features/tenant-submissions/tenant-utils.ts';

test('countDataFields: excludes structural section and grid layout containers', () => {
  const fields: FormField[] = [
    { id: 'sec_1', type: 'section', label: 'Section 1', required: false },
    { id: 'grid_1', type: 'grid', label: '2 Columns', required: false, columns: 2 },
    {
      id: 'f_name',
      type: 'name',
      label: 'Full Name',
      required: true,
      parentGridId: 'grid_1',
      gridColumn: 0,
    },
    {
      id: 'f_email',
      type: 'email',
      label: 'Email',
      required: true,
      parentGridId: 'grid_1',
      gridColumn: 1,
    },
    { id: 'sec_2', type: 'section', label: 'Section 2', required: false },
    {
      id: 'f_role',
      type: 'select',
      label: 'Role',
      required: false,
      options: [{ label: 'Option A', value: 'option_a' }],
    },
  ];

  assert.equal(countDataFields(fields), 3);
  assert.equal(countDataFields([]), 0);
  assert.equal(
    countDataFields([
      { id: 'sec_only', type: 'section', label: 'Only Section', required: false },
    ]),
    0,
  );
});

test('formatSubmissionValue: formats compound name and address regardless of PostgreSQL jsonb key order', () => {
  const nameField: FormField = {
    id: 'f_name',
    type: 'name',
    label: 'Name',
    required: true,
  };
  // PostgreSQL jsonb sorts shorter keys first: lastName (8) before firstName (9)
  assert.equal(
    formatSubmissionValue(
      { lastName: 'Tester', firstName: 'Alice' },
      nameField,
    ),
    'Alice Tester',
  );
  // Also works even without field metadata via shape inference
  assert.equal(
    formatSubmissionValue({ lastName: 'Doe', firstName: 'Jane' }),
    'Jane Doe',
  );

  const addressField: FormField = {
    id: 'f_addr',
    type: 'address',
    label: 'Address',
    required: false,
  };
  // PostgreSQL jsonb sorts: zip (3), city (4), state (5), street (6), country (7)
  assert.equal(
    formatSubmissionValue(
      {
        zip: '97477',
        city: 'Springfield',
        state: 'OR',
        street: '742 Evergreen Terrace',
        country: 'United States',
      },
      addressField,
    ),
    '742 Evergreen Terrace, Springfield, OR, 97477, United States',
  );
  // Partial address omits empty parts cleanly
  assert.equal(
    formatSubmissionValue(
      {
        zip: '',
        city: 'Seattle',
        state: 'WA',
        street: '100 Pine St',
        country: '',
      },
      addressField,
    ),
    '100 Pine St, Seattle, WA',
  );
});

test('formatSubmissionValue & getSubmissionPreview: resolves select and radio option values to labels', () => {
  const selectField: FormField = {
    id: 'f_card',
    type: 'select',
    label: 'Card Selection',
    required: true,
    options: [
      { label: 'Option A', value: 'option_a' },
      { label: 'Option B', value: 'option_b' },
    ],
  };
  const radioField: FormField = {
    id: 'f_plan',
    type: 'radio',
    label: 'Plan',
    required: true,
    options: [
      { label: 'Enterprise Plan', value: 'enterprise' },
      { label: 'Starter Plan', value: 'starter' },
    ],
  };

  assert.equal(formatSubmissionValue('option_a', selectField), 'Option A');
  assert.equal(formatSubmissionValue('enterprise', radioField), 'Enterprise Plan');
  assert.equal(
    formatSubmissionValue(['option_a', 'option_b'], selectField),
    'Option A, Option B',
  );
  // Unknown option value falls back cleanly to raw value
  assert.equal(formatSubmissionValue('legacy_value', selectField), 'legacy_value');

  const form: FormSchema = {
    id: 'form_1',
    clientId: 'client_1',
    slug: 'onboarding',
    title: 'Onboarding',
    fields: [
      { id: 'sec_1', type: 'section', label: 'Step 1', required: false },
      selectField,
    ],
    updatedAt: '2026-11-19T00:00:00.000Z',
  };
  const submission: SubmissionRecord = {
    id: 'sub_1',
    formId: 'form_1',
    clientId: 'client_1',
    values: { f_card: 'option_b' },
    submittedAt: '2026-11-19T00:00:00.000Z',
  };

  assert.equal(getSubmissionPreview(submission, form), 'Option B');
});

test('createInitialFormValues & toFieldQueryKey: prefills fields from URLSearchParams cleanly', () => {
  assert.equal(toFieldQueryKey('Work Email', 'f_1'), 'work_email');
  assert.equal(toFieldQueryKey('   ', 'f_fallback'), 'f_fallback');

  const form: FormSchema = {
    id: 'form_prefill',
    clientId: 'client_1',
    slug: 'intake',
    title: 'Client Intake',
    fields: [
      { id: 'sec_1', type: 'section', label: 'Details', required: false },
      { id: 'f_name', type: 'name', label: 'Full Name', required: true },
      { id: 'f_email', type: 'email', label: 'Work Email', required: true },
      {
        id: 'f_tier',
        type: 'select',
        label: 'Service Tier',
        required: false,
        options: [
          { label: 'Enterprise Plan', value: 'ent_tier' },
          { label: 'Starter Plan', value: 'starter_tier' },
        ],
      },
      {
        id: 'f_terms',
        type: 'checkbox',
        label: 'Accept Terms',
        required: true,
        defaultChecked: false,
      },
      { id: 'f_utm', type: 'text', label: 'UTM Source', required: false },
    ],
    updatedAt: '2026-11-19T00:00:00.000Z',
  };

  const params = new URLSearchParams({
    full_name: 'Alice Marie Tester',
    work_email: 'alice@acme.com',
    service_tier: 'Enterprise Plan',
    accept_terms: 'true',
    f_utm: 'linkedin_campaign',
  });

  const values = createInitialFormValues(form, params);
  assert.deepEqual(values.f_name, {
    firstName: 'Alice',
    lastName: 'Marie Tester',
  });
  assert.equal(values.f_email, 'alice@acme.com');
  assert.equal(values.f_tier, 'ent_tier');
  assert.equal(values.f_terms, true);
  assert.equal(values.f_utm, 'linkedin_campaign');
});

test('parseFormSchemaJson: preserves post-submit confirmation and redirectUrl fields', () => {
  const raw = JSON.stringify({
    id: 'form_post_submit',
    clientId: 'tenant_acme',
    slug: 'lead-capture',
    title: 'Lead Capture',
    thankYouTitle: 'Welcome aboard!',
    thankYouMessage: 'A specialist will reach out within 24 hours.',
    redirectUrl: 'https://acme.example/welcome',
    fields: [
      { id: 'sec_1', type: 'section', label: 'Section 1', required: false },
      { id: 'f_email', type: 'email', label: 'Email', required: true },
    ],
  });

  const parsed = parseFormSchemaJson(raw, 'tenant_acme');
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.equal(parsed.schema.thankYouTitle, 'Welcome aboard!');
    assert.equal(
      parsed.schema.thankYouMessage,
      'A specialist will reach out within 24 hours.',
    );
    assert.equal(parsed.schema.redirectUrl, 'https://acme.example/welcome');
  }
});
