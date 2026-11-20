import unittest
import _path  # noqa
from watch_pages import extract, diff

A = '<html><head><title>Charm | Coach</title><script>var p="$999"</script></head><body><p>Price $95.00</p><p>Was $120</p></body></html>'
B = '<html><head><title>Charm | Coach</title></head><body><p>Price $85.00</p><p>Was $120</p></body></html>'


class TestPages(unittest.TestCase):
    def test_extract_ignores_scripts(self):
        e = extract(A)
        self.assertEqual(e['title'], 'Charm | Coach')
        self.assertEqual(e['prices'], ['$95.00', '$120'])

    def test_price_change_detected(self):
        ev = diff(extract(A), extract(B))
        self.assertEqual(len(ev), 1)
        self.assertEqual(ev[0]['kind'], 'prices_changed')
        self.assertEqual(ev[0]['added'], ['$85.00'])
        self.assertEqual(ev[0]['removed'], ['$95.00'])

    def test_first_observation_is_not_a_change(self):
        self.assertEqual(diff(None, extract(A)), [])

    def test_identical_pages_no_events(self):
        self.assertEqual(diff(extract(A), extract(A)), [])


if __name__ == '__main__':
    unittest.main()
