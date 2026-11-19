import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addField,
  addFieldToSection,
  addSection,
  ensureLeadingSection,
  markFormAsDraft,
  moveField,
  moveSection,
  partitionFieldsIntoSections,
  publishFormSchema,
  removeField,
  removeSection,
  updateField,
  updateFormMetadata,
  type FormSchema,
} from '../../src/domain/form-schema/index.ts';
import { validateSection } from '../../src/domain/form-schema/validation.ts';
import { createTenantFormAction } from '../modules/forms/actions.ts';
import { InMemoryAppStore } from './in-memory-store.ts';

function makeBaseForm(fields: FormSchema['fields'] = []): FormSchema {
  return {
    id: 'form_test_1',
    clientId: 'tenant_acme',
    slug: 'test-form',
    title: 'Test Form',
    isPublished: true,
    fields,
    updatedAt: '2026-11-18T00:00:00.000Z',
  };
}

test('ensureLeadingSection: prepends Section 1 when missing and preserves existing titled section', () => {
  const legacy = makeBaseForm([
    {
      id: 'f_name',
      type: 'text',
      label: 'Full Name',
      required: true,
    },
  ]);

  const normalized = ensureLeadingSection(legacy);
  assert.equal(normalized.fields.length, 2);
  assert.equal(normalized.fields[0]?.type, 'section');
  assert.equal(normalized.fields[0]?.label, 'Section 1');
  assert.equal(normalized.fields[1]?.id, 'f_name');

  // Calling again returns the exact same object reference
  assert.equal(ensureLeadingSection(normalized), normalized);

  // Blank leading section label gets filled with default title
  const blankTitle = makeBaseForm([
    { id: 'sec_1', type: 'section', label: '   ', required: false },
  ]);
  const fixed = ensureLeadingSection(blankTitle);
  assert.equal(fixed.fields[0]?.label, 'Section 1');
});

test('partitionFieldsIntoSections: groups fields 1 section per page including grid children and legacy fallbacks', () => {
  const multi = makeBaseForm([
    { id: 'sec_1', type: 'section', label: 'Personal Details', required: false },
    { id: 'f_name', type: 'text', label: 'Full Name', required: true },
    { id: 'grid_1', type: 'grid', label: '2-Column Grid', required: false, columns: 2 },
    {
      id: 'f_city',
      type: 'text',
      label: 'City',
      required: true,
      parentGridId: 'grid_1',
      gridColumn: 0,
    },
    { id: 'sec_2', type: 'section', label: 'Account Setup', required: false },
    { id: 'f_email', type: 'email', label: 'Work Email', required: true },
  ]);

  const pages = partitionFieldsIntoSections(multi.fields);
  assert.equal(pages.length, 2);
  assert.equal(pages[0]?.title, 'Personal Details');
  assert.deepEqual(
    pages[0]?.topLevelFields.map((f) => f.id),
    ['f_name', 'grid_1'],
  );
  assert.deepEqual(
    pages[0]?.allFields.map((f) => f.id),
    ['f_name', 'f_city'],
  );

  assert.equal(pages[1]?.title, 'Account Setup');
  assert.deepEqual(
    pages[1]?.topLevelFields.map((f) => f.id),
    ['f_email'],
  );

  // Empty form still yields 1 default Section 1 page
  const emptyPages = partitionFieldsIntoSections([]);
  assert.equal(emptyPages.length, 1);
  assert.equal(emptyPages[0]?.title, 'Section 1');
  assert.equal(emptyPages[0]?.topLevelFields.length, 0);
});

test('section operations: addSection, addFieldToSection, moveSection, removeSection, and leading-section guards', () => {
  let schema = ensureLeadingSection(makeBaseForm());
  const sec1Id = schema.fields[0]!.id;

  schema = addFieldToSection(
    schema,
    { id: 'f_1', type: 'text', label: 'First', required: true },
    sec1Id,
  );
  schema = addSection(schema); // Section 2
  const sec2Id = schema.fields[2]!.id;
  assert.equal(schema.fields[2]?.label, 'Section 2');

  schema = addFieldToSection(
    schema,
    { id: 'f_2', type: 'email', label: 'Second', required: true },
    sec2Id,
  );

  // Insert a field specifically into Section 1 even though Section 2 exists
  schema = addFieldToSection(
    schema,
    { id: 'f_1b', type: 'text', label: 'First B', required: false },
    sec1Id,
  );
  assert.deepEqual(
    schema.fields.map((f) => f.id),
    [sec1Id, 'f_1', 'f_1b', sec2Id, 'f_2'],
  );

  // moveField cannot move a non-section field before index 0
  const clamped = moveField(schema, 1, 0);
  assert.equal(clamped.fields[0]?.id, sec1Id);

  // moveSection swaps entire sections cleanly
  const swapped = moveSection(schema, sec2Id, 'up');
  assert.deepEqual(
    swapped.fields.map((f) => f.id),
    [sec2Id, 'f_2', sec1Id, 'f_1', 'f_1b'],
  );

  // removeSection when deleting first section promotes second section and keeps fields
  const afterRemoveFirst = removeSection(swapped, sec2Id);
  assert.equal(afterRemoveFirst.fields[0]?.id, sec1Id);
  assert.deepEqual(
    afterRemoveFirst.fields.map((f) => f.id),
    [sec1Id, 'f_2', 'f_1', 'f_1b'],
  );

  // Cannot remove the only remaining section (via removeSection or removeField)
  assert.equal(removeSection(afterRemoveFirst, sec1Id), afterRemoveFirst);
  assert.equal(removeField(afterRemoveFirst, sec1Id), afterRemoveFirst);
});

test('validateSection: validates only the active section page without blocking on later sections', () => {
  const schema = makeBaseForm([
    { id: 'sec_1', type: 'section', label: 'Step 1', required: false },
    { id: 'f_name', type: 'text', label: 'Name', required: true },
    { id: 'sec_2', type: 'section', label: 'Step 2', required: false },
    { id: 'f_email', type: 'email', label: 'Email', required: true },
  ]);

  const pages = partitionFieldsIntoSections(schema.fields);
  const sec1Invalid = validateSection(pages[0]!, { f_name: '', f_email: '' });
  assert.equal(sec1Invalid.valid, false);
  assert.ok(sec1Invalid.errors.f_name);
  assert.equal(sec1Invalid.errors.f_email, undefined);

  const sec1Valid = validateSection(pages[0]!, {
    f_name: 'Ada Lovelace',
    f_email: '',
  });
  assert.equal(sec1Valid.valid, true);
  assert.deepEqual(sec1Valid.errors, {});
});

test('createTenantFormAction: defaults new forms to a titled Section 1 when fields are omitted', async () => {
  const store = new InMemoryAppStore();
  await store.createClient({
    id: 'tenant_acme',
    name: 'Acme Corp',
    slug: 'acme-corp',
    status: 'active',
    nowIso: new Date().toISOString(),
  });

  const res = await createTenantFormAction(store, 'tenant_acme', {
    title: 'Customer Survey',
    isPublished: true,
  });

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.fields[0]?.type, 'section');
    assert.equal(res.data.fields[0]?.label, 'Section 1');
    assert.equal(res.data.fields[1]?.type, 'text');
  }
});

test('markFormAsDraft & publishFormSchema: transitions published form to draft on builder edits and publishes on demand', () => {
  const initial = makeBaseForm([
    { id: 'sec_1', type: 'section', label: 'Section 1', required: false },
    { id: 'f_name', type: 'text', label: 'Full Name', required: true },
  ]);
  assert.equal(initial.isPublished, true);

  const afterAdd = markFormAsDraft(
    addField(initial, {
      id: 'f_email',
      type: 'email',
      label: 'Email',
      required: false,
    }),
  );
  assert.equal(afterAdd.isPublished, false);
  assert.equal(afterAdd.fields.length, 3);

  // Calling markFormAsDraft on an already-draft schema is idempotent and returns the same reference
  assert.equal(markFormAsDraft(afterAdd), afterAdd);

  const afterFieldEdit = markFormAsDraft(
    updateField(afterAdd, 'f_name', (current) => ({
      ...current,
      label: 'Applicant Name',
    })),
  );
  assert.equal(afterFieldEdit.isPublished, false);
  assert.equal(afterFieldEdit.fields[1]?.label, 'Applicant Name');

  const afterMetaEdit = markFormAsDraft(
    updateFormMetadata(afterFieldEdit, { title: 'Updated Application' }),
  );
  assert.equal(afterMetaEdit.isPublished, false);
  assert.equal(afterMetaEdit.title, 'Updated Application');

  const published = publishFormSchema(afterMetaEdit);
  assert.equal(published.isPublished, true);
  assert.equal(published.title, 'Updated Application');
  assert.equal(published.fields.length, 3);
});
