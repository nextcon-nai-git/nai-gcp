import contextlib
import importlib.util
import io
import os
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("soc_monitor_driver", "scripts/soc/monitor.py")
driver = importlib.util.module_from_spec(spec)
spec.loader.exec_module(driver)

class Response:
    def __init__(self, value):
        self.content = driver.json.dumps(value).encode()
    def __enter__(self): return self
    def __exit__(self, *args): pass
    def read(self, limit): return self.content[:limit]

class DriverTests(unittest.TestCase):
    def run_driver(self, replies):
        output = io.StringIO()
        with patch.dict(os.environ, {"SOC_MONITOR_SECRET": "private-key-" * 4}), patch.object(driver.urllib.request, "build_opener") as factory, contextlib.redirect_stdout(output):
            factory.return_value.open.side_effect = [Response(r) if isinstance(r, dict) else r for r in replies]
            status = driver.main()
            requests = [driver.json.loads(c.args[0].data) for c in factory.return_value.open.call_args_list]
        self.assertNotIn("private-key", output.getvalue())
        return status, requests, output.getvalue()
    def plan(self): return {"companyIds":["101","102"],"missingAuthorizedCompanies":[],"unknownActivityCompanies":[],"start":"2026-09-26","end":"2026-10-26"}
    def test_follows_all_batches_and_companies(self):
        status, requests, output = self.run_driver([self.plan(), {"issuedAsosInBatch":3,"rosterHash":"hash","nextOffset":150}, {"issuedAsosInBatch":1,"rosterHash":"hash","nextOffset":None}, {"issuedAsosInBatch":0,"rosterHash":"other","nextOffset":None}])
        self.assertEqual(status, 0)
        self.assertEqual(requests[2]["offset"], 150)
        self.assertEqual(requests[2]["rosterHash"], "hash")
        self.assertNotIn("rosterHash", requests[3])
        self.assertIn("2/2", output)
    def test_does_not_claim_success_for_partial_coverage(self):
        status, requests, output = self.run_driver([self.plan(), driver.urllib.error.HTTPError(driver.URL,409,"secret provider body",{},None), {"issuedAsosInBatch":0,"rosterHash":"hash","nextOffset":None}])
        self.assertEqual(status,1)
        self.assertEqual(requests[-1]["companyId"],"102")
        self.assertNotIn("secret provider body",output)
    def test_missing_authorized_company_fails_even_with_successful_batches(self):
        plan=self.plan();plan["companyIds"]=[];plan["missingAuthorizedCompanies"]=["101"]
        self.assertEqual(self.run_driver([plan])[0],1)
    def test_non_advancing_cursor_fails(self):
        plan=self.plan();plan["companyIds"]=["101"]
        self.assertEqual(self.run_driver([plan,{"issuedAsosInBatch":1,"rosterHash":"hash","nextOffset":0}])[0],1)
    def test_rejects_redirects_instead_of_forwarding_credentials(self):
        self.assertIsNone(driver.NoRedirect().redirect_request(None,None,302,"",{},"https://elsewhere.invalid"))

if __name__ == "__main__": unittest.main()
