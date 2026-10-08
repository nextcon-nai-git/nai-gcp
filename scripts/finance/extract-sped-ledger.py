#!/usr/bin/env python3
"""Extract a SPED landscape Livro Diário into the validated NAI interchange format.
Usage: python extract-sped-ledger.py source.pdf ledger.json
Dependency: pdfplumber. Keep the PDF and resulting JSON OUT of the source repository.
"""
import argparse
import collections
import datetime
import hashlib
import json
import re
from pathlib import Path
import pdfplumber


def extract(source):
    rows = []
    continuations = 0
    with pdfplumber.open(source) as pdf:
        header = pdf.pages[0].extract_text()
        company = re.search(r'Entidade:\s*(.+)', header).group(1).strip()
        tax_id = re.search(r'CNPJ:\s*([\d./-]+)', header).group(1)
        period = re.search(r'Escrituração:\s*(\d{2}/\d{2}/\d{4}) a (\d{2}/\d{2}/\d{4})', header)
        iso = lambda s: datetime.datetime.strptime(s, '%d/%m/%Y').date().isoformat()
        for number, page in enumerate(pdf.pages, 1):
            assert (page.width, page.height) == (792, 612), f'Unsupported page size: {number}'
            tables = page.crop((38, 128, 754, 572)).extract_tables({
                'vertical_strategy': 'explicit',
                'explicit_vertical_lines': [38, 102, 179, 292, 382.5, 555, 652, 728, 754],
            })
            page_count = 0
            for table in tables:
                for row in table:
                    row = [' '.join((v or '').split()) for v in row]
                    if len(row) != 8 or row[0] == 'Data' or not any(row):
                        continue
                    date, account, name, cost, history, entry, amount, side = row
                    if not date:
                        if not any([account, entry, amount, side]) and rows:
                            for k,v in [('accountName',name),('costCenter',cost),('history',history)]:
                                if v: rows[-1][k] = (rows[-1][k] + ' ' + v).strip()
                            if any([name, cost, history]):
                                rows[-1]['endPage'] = number
                                continuations += 1
                            continue
                        raise ValueError(f'Unexpected continuation on page {number}: {row}')
                    assert re.fullmatch(r'\d{2}/\d{2}/\d{4}', date), (number,row)
                    assert re.fullmatch(r'\d+(?:\.\d+)+', account), (number,row)
                    assert entry.isdigit() and side in ('D','C'), (number,row)
                    assert re.fullmatch(r'R\$ [\d.]+,\d{2}', amount), (number,row)
                    cents = int(amount.replace('R$ ','').replace('.','').replace(',',''))
                    rows.append(dict(id=f'p{number}-r{page_count+1}', date=iso(date), account=account, accountName=name, costCenter=cost, history=history, entry=entry, amountCents=cents, side=side, page=number, endPage=number))
                    page_count += 1
            # Independently count value/side anchors to ensure no omitted or duplicated records.
            words = page.extract_words()
            anchors = [w for w in words if 730 < w['x0'] < 748 and 148 <= w['top'] < 572 and w['text'] in ('D','C')]
            assert len(anchors) == page_count, f'Page {number}: {len(anchors)} anchors, {page_count} extracted rows'
        pages = len(pdf.pages)
    totals = collections.Counter()
    balances = collections.Counter()
    for row in rows:
        totals[row['side']] += row['amountCents']
        balances[row['date']+'|'+row['entry']] += row['amountCents'] * (1 if row['side']=='D' else -1)
    return dict(schemaVersion=1, company=company, cnpj=tax_id, periodStart=iso(period[1]), periodEnd=iso(period[2]), bookNumber=re.search(r'Ordem do Livro:\s*(\d+)',header).group(1), sourceName=Path(source).name, sourceSha256=hashlib.sha256(Path(source).read_bytes()).hexdigest(), pageCount=pages, rows=rows), dict(rows=len(rows),entries=len(balances),debitCents=totals['D'],creditCents=totals['C'],unbalancedEntries=sum(v!=0 for v in balances.values()),pageContinuations=continuations)

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    data, summary=extract(args.source)
    args.output.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
    print(json.dumps(summary,indent=2))
