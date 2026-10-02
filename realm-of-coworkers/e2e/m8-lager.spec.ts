// Abnahme M8 (16.2): Registrieren, Held erstellen, ausrüsten, Gem kombinieren, verzaubern – auf dem Handy.
import { expect, test } from '@playwright/test';
import { admin, registerWithHero } from './helpers';

test('Registrieren, Held erstellen, ausrüsten, Gem kombinieren, verzaubern', async ({ page }) => {
  await registerWithHero(page, 'mira', 'Eisenfaust', 'krieger');

  // Testdaten wie nach einigen Stages: Gold, ein Helm im Inventar, 3 gleiche Gems, Waffe auf Stufe 10
  admin('gold', 'Eisenfaust', '20000');
  admin('item', 'Eisenfaust', 'helm', '3', 'selten');
  admin('gems', 'Eisenfaust', 'granat', '1', '3');
  admin('weapon-level', 'Eisenfaust', '10');
  await page.reload();
  await expect(page.getByTestId('gold')).toContainText('20.000');

  // Ausrüsten: Helm im Inventar antippen, Vergleich sehen, anlegen
  await page.getByTestId('station-equip').click();
  await expect(page.getByTestId('slot-Helm')).toHaveClass(/empty/);
  await page.getByTestId('inventory').locator('button').first().click();
  await expect(page.getByTestId('item-detail')).toBeVisible();
  await page.getByTestId('item-equip').click();
  await expect(page.getByTestId('item-detail')).toBeHidden();
  await expect(page.getByTestId('slot-Helm')).not.toHaveClass(/empty/);
  await expect(page.getByTestId('slot-Helm').locator('.slot-item')).not.toBeEmpty();
  await expect(page.getByTestId('inventory').locator('button')).toHaveCount(0);
  await page.getByTestId('equipment').getByRole('button', { name: 'Schließen' }).click();

  // Gem kombinieren: 3 × Roh-Granat ergeben einen geschliffenen Granat, kostet Gold
  await page.getByTestId('station-jeweler').click();
  await expect(page.getByTestId('gem-granat:1')).toContainText('×3');
  await page.getByTestId('combine-granat:1').click();
  await expect(page.getByTestId('gem-granat:2')).toContainText('×1');
  await expect(page.getByTestId('gem-granat:1')).toHaveCount(0);
  await page.getByTestId('jeweler').getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByTestId('gold')).not.toContainText('20.000');

  // Verzaubern: Art wählen (bestätigen), dann Rang +1
  await page.getByTestId('station-smith').click();
  await page.getByTestId('enchant-type-0').selectOption('kraft');
  await page.getByTestId('confirm-yes').click();
  await expect(page.getByTestId('enchant-line-0')).toContainText('Rang 0/5');
  await page.getByTestId('enchant-rank-0').click();
  await expect(page.getByTestId('enchant-line-0')).toContainText('Rang 1/5');
});
