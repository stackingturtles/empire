import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { parseProject } from '../src/model';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('analyses the portal and invalidates results on edits and undo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await expect(page.getByRole('heading', { name: 'Single-bay portal frame' })).toBeVisible();
  await page.getByRole('button', { name: 'Analyse', exact: false }).click();
  await expect(page.getByText(/Solved · \d+ free DOFs/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Moment', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Select node 2', exact: true }).click();
  const force = page.getByRole('spinbutton', { name: 'Horizontal force' });
  await force.fill('20');
  await force.press('Tab');
  await expect(page.getByRole('button', { name: 'Moment', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(force).toHaveValue('12');
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(force).toHaveValue('20');
  expect(errors).toEqual([]);
});

test('supports keyboard-accessible creation, sections and deletion guards', async ({ page }) => {
  await page.getByRole('button', { name: 'Add node', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Node 5', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'X coordinate' }).fill('8');
  await page.getByRole('spinbutton', { name: 'X coordinate' }).press('Tab');
  await page.getByRole('button', { name: 'Add member', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Member 4', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Node 1', exact: false }).first().click();
  await page.getByRole('button', { name: 'Delete node', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('attached members');
  await page.getByRole('button', { name: 'Add section', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Section name' })).toHaveValue('Custom section 2');
});

test('loads beam example and checks analytical reactions', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('summary').filter({ hasText: 'Examples' }).click();
  await page.getByRole('button', { name: 'Simply supported beam', exact: true }).click();
  await page.getByRole('button', { name: 'Analyse', exact: false }).click();
  await page.getByRole('button', { name: 'Reactions', exact: true }).click();
  const table = page
    .getByRole('region', { name: 'Analysis results' })
    .locator('.result-table-wrap');
  await expect(table).toContainText('15.000');
  await expect(table.locator('tbody tr')).toHaveCount(2);
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(table).toContainText('22.500');
});

test('loads and analyses the three-bay, four-storey example and serves a matching project file', async ({
  page,
}) => {
  page.on('dialog', (dialog) => dialog.accept());
  await page.locator('summary').filter({ hasText: 'Examples' }).click();
  await page.getByRole('button', { name: 'Three-bay, four-storey frame', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Three-bay, four-storey frame' })).toBeVisible();
  await expect(page.locator('.node-hit')).toHaveCount(20);
  await expect(page.locator('.member-hit')).toHaveCount(28);
  await expect(page.getByRole('checkbox', { name: 'Include self-weight' })).toBeChecked();

  const response = await page.request.get('/examples/three-bay-four-storey.empire.json');
  expect(response.ok()).toBe(true);
  const fixture = parseProject(await response.text());
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('empire-2d.project.v1')!)),
  ).toEqual(fixture);

  await page.getByRole('button', { name: 'Select node 17', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Y coordinate' })).toHaveValue('14');
  await expect(page.getByRole('spinbutton', { name: 'Horizontal force' })).toHaveValue('20');
  await page.getByRole('button', { name: 'Select member 17', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Load at start' })).toHaveValue('-10');
  await page.getByRole('button', { name: 'Select member 26', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Load at start' })).toHaveValue('-7.5');

  await page.getByRole('button', { name: 'Analyse', exact: false }).click();
  await expect(page.getByText('Solved · 48 free DOFs')).toBeVisible();
  const rows = page.getByRole('region', { name: 'Numerical results table' }).locator('tbody tr');
  await expect(rows).toHaveCount(20);
  for (const diagram of ['Moment', 'Shear', 'Axial']) {
    await page.getByRole('button', { name: diagram, exact: true }).click();
    await expect(page.locator('.result-diagram')).toHaveCount(28);
  }
  await page.getByRole('button', { name: 'Reactions', exact: true }).click();
  await expect(rows).toHaveCount(4);
  await page.getByRole('button', { name: 'Members', exact: true }).click();
  await expect(rows).toHaveCount(28);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Three-bay, four-storey frame' })).toBeVisible();
});

test('cancelling the building example preserves existing work', async ({ page }) => {
  const name = page.getByRole('textbox', { name: 'Project name', exact: true });
  await name.fill('My existing work');
  await name.press('Tab');
  page.on('dialog', (dialog) => dialog.dismiss());
  await page.locator('summary').filter({ hasText: 'Examples' }).click();
  await page.getByRole('button', { name: 'Three-bay, four-storey frame', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My existing work' })).toBeVisible();
  await expect(page.locator('.node-hit')).toHaveCount(4);
});

test('downloads JSON, restores autosave and rejects bad imports without losing the model', async ({
  page,
}) => {
  await page.getByRole('textbox', { name: 'Project name', exact: true }).fill('My restored frame');
  await page.getByRole('textbox', { name: 'Project name', exact: true }).press('Tab');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save copy', exact: false }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('My-restored-frame.empire.json');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'My restored frame', exact: true })).toBeVisible();
  await page.getByLabel('Open project file').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":999}'),
  });
  await expect(page.getByRole('alert')).toContainText('Invalid project');
  await expect(page.getByRole('heading', { name: 'My restored frame', exact: true })).toBeVisible();
});

test('preserves a corrupt autosave until an intentional edit', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('empire-2d.project.v1', 'broken project'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Could not restore');
  expect(await page.evaluate(() => localStorage.getItem('empire-2d.project.v1'))).toBe(
    'broken project',
  );
  const name = page.getByRole('textbox', { name: 'Project name', exact: true });
  await name.fill('Recovered model');
  await name.press('Tab');
  await expect
    .poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('empire-2d.project.v1')!).name))
    .toBe('Recovered model');
});

test('can download a backup when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage blocked', 'QuotaExceededError');
    };
  });
  await page.reload();
  await expect(page.getByText('Local save unavailable · download a copy')).toBeVisible();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save copy', exact: false }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.empire\.json$/);
});

test('rejects invalid coordinate edits and restores the displayed input', async ({ page }) => {
  await page.getByRole('button', { name: 'Select node 2', exact: true }).click();
  const x = page.getByRole('spinbutton', { name: 'X coordinate' });
  await x.fill('20000');
  await x.press('Tab');
  await expect(page.getByRole('alert')).toContainText('nodes.1.x');
  await expect(x).toHaveValue('0');
});

test('imports valid JSON and refuses an unstable model', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  const project = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('empire-2d.project.v1')!),
  );
  project.name = 'Unstable example';
  project.nodes.forEach((node: { support: string }) => {
    node.support = 'free';
  });
  await page.getByLabel('Open project file').setInputFiles({
    name: 'model.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(project)),
  });
  await expect(page.getByRole('heading', { name: 'Unstable example' })).toBeVisible();
  await page.getByRole('button', { name: 'Analyse', exact: false }).click();
  await expect(page.getByRole('alert')).toContainText(/unstable|unrestrained/);
});

test('SVG tools connect nodes and place a new snapped node', async ({ page }) => {
  await page.getByRole('button', { name: 'Connect nodes', exact: true }).click();
  await page.getByRole('button', { name: 'Select node 1', exact: true }).click();
  await page.getByRole('button', { name: 'Select node 3', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Member 4', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Place node', exact: true }).click();
  const svg = page.getByLabel('Structural frame drawing');
  await svg.click({ position: { x: 80, y: 120 } });
  await expect(page.getByRole('heading', { name: 'Node 5', exact: true })).toBeVisible();
});

test('has no automated accessibility violations in model, results and help', async ({ page }) => {
  await expect(async () => {
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }).toPass();
  await page.getByRole('button', { name: 'Analyse', exact: false }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  for (const name of ['Select node 2', 'Select member 2', 'HE100A · steel']) {
    await page.getByRole('button', { name, exact: true }).click();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'About and instructions', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test('does not overflow on a phone and provides accessible help', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('button', { name: 'Analyse', exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Node 2', exact: false }).first().click();
  await expect(page.getByRole('spinbutton', { name: 'Horizontal force' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'About and instructions', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
