import unittest
import _path  # noqa
from refresh_leads import get_items, triage, merge, norm

XML = b'''<?xml version="1.0"?><rss><channel>
<item><title>Catbird adds new WNBA charm - Example</title><link>https://news.example/a</link><pubDate>Thu, 19 Nov 2026 19:00:00 GMT</pubDate><source>Example</source></item>
<item><title>Fever vs Sky recap: highlights and score - Example</title><link>https://news.example/b</link><pubDate>Thu, 19 Nov 2026 19:00:00 GMT</pubDate></item>
<item><title>Studio announces new collection with WNBA team - Example</title><link>https://news.example/c</link></item>
<item><title>Unsafe</title><link>http://insecure.example/d</link></item>
<item><title>Local bakery opens new store</title><link>https://news.example/e</link></item>
</channel></rss>'''


class TestLeads(unittest.TestCase):
    def test_parse_and_https_only(self):
        rows = get_items(XML)
        self.assertEqual(len(rows), 4)
        self.assertEqual(rows[0]['title'], 'Catbird adds new WNBA charm')
        self.assertEqual(rows[0]['published'], '2026-11-19')

    def test_triage_filters_noise_and_irrelevant(self):
        kept = [triage(r) for r in get_items(XML)]
        self.assertIsNotNone(kept[0])      # tracked brand
        self.assertIsNone(kept[1])         # game recap
        self.assertIsNotNone(kept[2])      # new name
        self.assertIsNone(kept[3])         # bakery
        self.assertEqual(kept[0]['kind'], 'update on a tracked item')
        self.assertEqual(kept[2]['kind'], 'new name to check')

    def test_fever_boosted(self):
        a = triage({'title': 'Fever launch new collection', 'url': 'https://x.test/1', 'source': 's', 'published': None})
        b = triage({'title': 'Sparks launch new collection', 'url': 'https://x.test/2', 'source': 's', 'published': None})
        self.assertTrue(a['fever'])
        self.assertGreater(a['score'], b['score'])

    def test_merge_keeps_first_seen_and_status(self):
        lead = triage({'title': 'Fever launch new collection', 'url': 'https://x.test/1', 'source': 's', 'published': None})
        q1 = merge([], [lead], '2026-11-01')
        q1[0]['status'] = 'reviewed'
        q2 = merge(q1, [lead], '2026-11-10')
        self.assertEqual(len(q2), 1)
        self.assertEqual(q2[0]['first_seen'], '2026-11-01')
        self.assertEqual(q2[0]['status'], 'reviewed')
        self.assertEqual(q2[0]['last_seen'], '2026-11-10')

    def test_stale_unreviewed_expire(self):
        lead = triage({'title': 'Fever launch new collection', 'url': 'https://x.test/1', 'source': 's', 'published': None})
        q = merge([], [lead], '2026-01-01')
        self.assertEqual(merge(q, [], '2026-11-01'), [])


if __name__ == '__main__':
    unittest.main()
