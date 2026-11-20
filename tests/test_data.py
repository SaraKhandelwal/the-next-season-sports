import unittest
import _path  # noqa
from rubric import load, finding_strength, computed_level
import validate


class TestData(unittest.TestCase):
    def test_no_problems(self):
        self.assertEqual(validate.problems(), [])

    def test_scale(self):
        L = load('launches.json')['launches']
        self.assertGreaterEqual(len(L), 15)
        self.assertGreaterEqual(len(load('findings.json')['findings']), 5)

    def test_atlanta_share_is_bounded(self):
        L = load('launches.json')['launches']
        atl = [l for l in L if l['team'] == 'Atlanta Dream']
        self.assertLessEqual(len(atl) / len(L), 0.25, 'sample is too Atlanta-heavy')

    def test_claims_not_used_as_price_evidence(self):
        for l in load('launches.json')['launches']:
            if l['price']:
                kinds = {f['k'] for f in l['facts'] if f['s'] == l['price']['source']}
                self.assertIn('price', kinds)

    def test_unaudited_sales_figures_never_feed_a_rating(self):
        # The Liberty profile's sales numbers are flagged 'claim'; make sure that flag stays.
        l = {x['id']: x for x in load('launches.json')['launches']}['liberty-ops']
        sales = [f for f in l['facts'] if '80%' in f['t'] or '30%' in f['t']]
        self.assertTrue(sales and all(f['k'] == 'claim' for f in sales))

    def test_every_finding_strength_is_rule_based(self):
        R = load('rubric.json')
        L = {l['id']: l for l in load('launches.json')['launches']}
        order = R['levels']
        for f in load('findings.json')['findings']:
            final, comp, na, nl = finding_strength(f, L, R)
            self.assertLessEqual(order.index(final), order.index(comp))
            if f.get('cap'):
                self.assertTrue(f['cap']['reason'])

    def test_rubric_thresholds(self):
        R = load('rubric.json')
        self.assertEqual(computed_level(1, 1, R), 'Single case')
        self.assertEqual(computed_level(2, 1, R), 'Early signal')
        self.assertEqual(computed_level(4, 2, R), 'Moderate')
        self.assertEqual(computed_level(5, 1, R), 'Moderate')  # one league never reaches Strong
        self.assertEqual(computed_level(5, 2, R), 'Strong')

    def test_baseline_limits_stated(self):
        b = load('price_baseline.json')
        self.assertTrue(b['limits'])
        self.assertLess(b['regular_low'], b['regular_high'])

    def test_changelog_has_entries_with_dates(self):
        for e in load('changelog.json')['entries']:
            self.assertRegex(e['date'], r'^\d{4}-\d{2}-\d{2}$')


if __name__ == '__main__':
    unittest.main()
