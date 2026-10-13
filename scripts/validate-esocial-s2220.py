"""Validate unsigned S-2220 content against the unmodified official XSD.
Usage: python scripts/validate-esocial-s2220.py /absolute/path/to/draft.xml
Requires lxml. A full document must fail ONLY because its real XMLDSig is absent.
This does not certify a signature, RET/business rules, transmission or acceptance.
"""
from pathlib import Path
import sys
from lxml import etree

root = Path(__file__).resolve().parents[1]
schema = etree.XMLSchema(etree.parse(str(root / "tests/fixtures/esocial/s-1.3-20260701/evtMonit.xsd")))
xml = etree.parse(sys.argv[1])
assert not xml.xpath("//*[local-name()='Signature']"), "Draft must not contain a simulated signature"
assert not schema.validate(xml), "Unsigned envelope unexpectedly passed the full signature-required schema"
errors = list(schema.error_log)
assert len(errors) == 1 and "{http://www.w3.org/2000/09/xmldsig#}Signature" in errors[0].message and "Missing child element" in errors[0].message, "\n".join(error.message for error in errors)
print("S-2220 content accepted by official S-1.3 XSD; full envelope correctly rejected for missing signature. No transmission performed.")
