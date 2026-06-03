#!/usr/bin/env python3
"""Parse Kia Germany PDF pricelist text extracts into structured JSON."""
from __future__ import annotations

import json
import re
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXTRACT_DIR = ROOT / 'scripts' / 'pdf-extract'
OUT_DIR = ROOT / 'src' / 'data' / 'kia' / 'pricelist-imports'

FILE_META = {
    'Kia-Germany-Picanto_Preisliste': {'modelKey': 'picanto', 'model': 'Picanto', 'variant': 'verbrenner'},
    'Kia-Germany-Stonic-Preisliste': {'modelKey': 'stonic', 'model': 'Stonic', 'variant': 'verbrenner'},
    'Kia-Germany-XCeed_Pricelist': {'modelKey': 'xceed', 'model': 'XCeed', 'variant': 'verbrenner'},
    'Kia-Germany-K4-Preisliste': {'modelKey': 'k4', 'model': 'K4', 'variant': 'verbrenner'},
    'Kia-Germany-K4-Sportswagon-Preisliste': {'modelKey': 'k4-sportswagon', 'model': 'K4 Sportswagon', 'variant': 'verbrenner'},
    'Kia-Germany-Seltos-Preisliste': {'modelKey': 'seltos', 'model': 'Seltos', 'variant': 'verbrenner'},
    'Kia-Germany-Sportage-Preisliste': {'modelKey': 'sportage', 'model': 'Sportage', 'variant': 'verbrenner'},
    'Kia-Germany-Sportage-PHEV-Preisliste': {'modelKey': 'sportage-phev', 'model': 'Sportage Plug-in Hybrid', 'variant': 'phev'},
    'Kia-Germany-Sorento-pricelist': {'modelKey': 'sorento', 'model': 'Sorento', 'variant': 'verbrenner'},
    'Kia-Germany-Sorento-Hybrid-pricelist': {'modelKey': 'sorento-hybrid', 'model': 'Sorento Hybrid', 'variant': 'hybrid'},
    'Kia-Germany-Sorento-PHEV-Preisliste': {'modelKey': 'sorento-phev', 'model': 'Sorento Plug-in Hybrid', 'variant': 'phev'},
    'Kia-Germany-EV2-Preisliste': {'modelKey': 'ev2', 'model': 'EV2', 'variant': 'elektro'},
    'Kia-Germany-EV3-Preisliste': {'modelKey': 'ev3', 'model': 'EV3', 'variant': 'elektro'},
    'Kia-Germany-EV4-Preisliste': {'modelKey': 'ev4', 'model': 'EV4', 'variant': 'elektro'},
    'Kia-Germany-EV5-Preisliste': {'modelKey': 'ev5', 'model': 'EV5', 'variant': 'elektro'},
    'Kia-Germany-EV5-GT-Preisliste': {'modelKey': 'ev5-gt', 'model': 'EV5 GT', 'variant': 'elektro-gt'},
    'Kia-Germany-EV6_Pricelist': {'modelKey': 'ev6', 'model': 'EV6', 'variant': 'elektro'},
    'Kia-Germany-EV9-Preisliste': {'modelKey': 'ev9', 'model': 'EV9', 'variant': 'elektro'},
    'Kia-Germany-PV5-Passenger-Preisliste': {'modelKey': 'pv5-passenger', 'model': 'PV5 Passenger', 'variant': 'nutzfahrzeug'},
}

TRIM_NAMES = {
    'core', 'vision', 'spirit', 'black edition', 'black\n edition', 'gt-line', 'gt line',
    'air', 'earth', 'light', 'plus', 'premium', 'inspiration', 'gravity', 'motion',
    'style', 'design', 'tech', 'gt', 'wave', 'land', 'business', 'pro', 'active',
}

PRICE_PAIR_RE = re.compile(
    r'(\d{1,3}(?:\.\d{3})*,\d{2})'
)

KNOWN_TRIMS = re.compile(
    r'^(Core|Vision|Spirit|Black\s+Edition|GT-Line|GT Line|Air|Earth|Light|Plus|Premium|'
    r'Motion|Style|Design|Tech|Gravity|Inspiration|Wave|Land|Business|Pro|Active|'
    r'Standard|Comfort|Premium Plus|GT|Platinum|Gravity)(?:\s|$)',
    re.I,
)

EV_INLINE_RE = re.compile(
    r'\b(Air|Earth|GT-Line|Light|Plus|Premium|Gravity|Inspiration|GT)\b'
    r'\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2})',
    re.I,
)


def parse_price_line(line: str) -> tuple[str, int | None, int] | None:
    normalized = re.sub(r'\t', ' ', line).strip()
    if not normalized or normalized.startswith('Doppelkupplungs') or normalized.startswith('getriebe'):
        return None
    amounts = list(PRICE_PAIR_RE.finditer(normalized))
    if not amounts:
        return None
    gross = parse_euro(amounts[-1].group(1))
    if gross < 10000 or gross > 250000:
        return None
    net = parse_euro(amounts[-2].group(1)) if len(amounts) >= 2 else None
    trim_end = amounts[-2].start() if len(amounts) >= 2 else amounts[-1].start()
    trim = normalized[:trim_end].strip()
    trim = re.sub(r'\s+', ' ', trim)
    if not trim or not KNOWN_TRIMS.match(trim):
        return None
    return normalize_trim(trim), net, gross

ENGINE_LINE_RE = re.compile(
    r'(?P<fuel>Benzin|Diesel|Benzin,\s*Hybrid|Elektro|Plug-in|Hybrid)?'
    r'[\s\t]*(?P<motor>[\d,\.]+\s*(?:T-GDI|CRDi|kWh-Batterie|kW)[^\n]{0,80})',
    re.I,
)

WLTP_RE = re.compile(
    r'Kia\s+([^\n:]+):\s*(Kraftstoffverbrauch|Stromverbrauch)[^\n]+',
    re.I,
)


def slug(s: str) -> str:
    s = re.sub(r'\s+', '-', s.strip().lower())
    s = re.sub(r'[^a-z0-9\-]', '', s.replace('ä', 'a').replace('ö', 'o').replace('ü', 'u'))
    return s or 'unknown'


def parse_euro(s: str) -> int:
    cleaned = re.sub(r'\s', '', s)
    if ',' in cleaned:
        cleaned = cleaned.split(',')[0]
    cleaned = cleaned.replace('.', '')
    return int(cleaned)


def normalize_trim(name: str) -> str:
    n = re.sub(r'\s+', ' ', name.strip())
    return n


def extract_trims_from_highlights(text: str) -> list[str]:
    trims = []
    for m in re.finditer(r'\n(Air|Earth|GT-Line|Core|Vision|Spirit|Black Edition|Light|Plus|Premium|Motion|Style|Design|Tech|Gravity|Inspiration|Wave|Land|Business|Pro|Active)\n', text, re.I):
        t = normalize_trim(m.group(1))
        if t not in trims:
            trims.append(t)
    return trims


def extract_variants(text: str) -> list[dict]:
    variants = []
    lines = text.splitlines()
    in_table = False
    current_engine = ''
    current_transmission = ''
    current_drive = ''
    current_power = ''
    current_consumption = ''
    current_co2 = ''
    current_co2_class = ''

    for i, raw in enumerate(lines):
        line = raw
        if 'EUR inkl' in line or (line.strip().startswith('19 % MwSt') and i > 0 and 'EUR' in lines[i - 1]):
            in_table = True
            continue
        if not in_table:
            continue
        if line.strip().startswith('Preise') and i + 1 < len(lines) and 'Ausstattung' in lines[i + 1]:
            break
        if re.match(r'^\d+\s+Kraftstoffverbrauch', line.strip()) or line.strip().startswith('●\t='):
            break

        flat = re.sub(r'\t', ' ', line).strip()
        if re.search(r'Batterie|kW\s*\(|T-GDI|CRDi|Automatik|Schaltgetriebe|DCT|AMT|Frontantrieb|Hybrid|Plug-in|Diesel|Benzin', flat, re.I):
            if not parse_price_line(line):
                if 'Batterie' in flat or 'T-GDI' in flat or 'CRDi' in flat or re.search(r'\d+\s*kW', flat):
                    current_engine = flat[:140]
                if 'Schaltgetriebe' in flat or 'DCT' in flat or 'Automatik' in flat or 'AMT' in flat:
                    current_transmission = flat[:100]
                if '2WD' in flat:
                    current_drive = '2WD'
                elif 'AWD' in flat:
                    current_drive = 'AWD'
                pm = re.search(r'(\d+)\s*\(\s*(\d+)\s*\)', flat)
                if pm:
                    current_power = f'{pm.group(1)} kW ({pm.group(2)} PS)'
                cons = re.search(r'(\d[\d\s]*,\s*\d)\s+(\d{2,3})\s+([A-G](?:\s*[–-]\s*[A-G])?)', flat)
                if cons:
                    current_consumption = cons.group(1).replace(' ', '')
                    current_co2 = cons.group(2)
                    current_co2_class = cons.group(3).replace(' ', '')

        parsed = parse_price_line(line)
        if parsed:
            trim, net, gross = parsed
            variants.append({
                'trim': trim,
                'trimId': slug(trim),
                'priceNet': net,
                'priceGross': gross,
                'engine': current_engine,
                'transmission': current_transmission,
                'drive': current_drive,
                'power': current_power,
                'consumption': current_consumption,
                'co2': current_co2,
                'co2Class': current_co2_class,
            })

    return variants


def extract_ev_variants(text: str) -> list[dict]:
    variants = []
    seen = set()
    for m in EV_INLINE_RE.finditer(text):
        trim = normalize_trim(m.group(1))
        key = (trim, m.group(3))
        if key in seen:
            continue
        seen.add(key)
        gross = parse_euro(m.group(3))
        if gross < 10000:
            continue
        variants.append({
            'trim': trim,
            'trimId': slug(trim),
            'priceNet': parse_euro(m.group(2)),
            'priceGross': gross,
            'engine': '',
            'transmission': '',
            'drive': '',
            'power': '',
            'consumption': '',
            'co2': '',
            'co2Class': '',
        })
    return variants


def extract_wltp(text: str) -> list[str]:
    notes = []
    for m in WLTP_RE.finditer(text):
        notes.append(m.group(0).strip())
    # dedupe
    seen = set()
    out = []
    for n in notes:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out[:8]


def extract_trim_prices_ab(text: str) -> list[dict]:
    """Fallback: ab € prices near trim headers."""
    results = []
    for m in re.finditer(
        r'(Core|Vision|Spirit|Black Edition|GT-Line|Air|Earth|Light|Plus|Premium|Motion|Style)\s*\n.*?ab\s*\n€\s*([\d.]+,\d{2})',
        text,
        re.I | re.S,
    ):
        results.append({'trim': normalize_trim(m.group(1)), 'priceFromGross': parse_euro(m.group(2))})
    return results


def parse_file(stem: str, text: str) -> dict:
    meta = FILE_META[stem]
    variants = extract_variants(text)
    if meta['variant'] in ('elektro', 'elektro-gt', 'phev') and len(variants) < 2:
        ev_variants = extract_ev_variants(text)
        if len(ev_variants) > len(variants):
            variants = ev_variants
    if len(variants) == 0:
        variants = extract_ev_variants(text)
    trims = extract_trims_from_highlights(text)
    if not trims:
        trims = sorted({v['trim'] for v in variants}, key=lambda t: variants.index(next(x for x in variants if x['trim'] == t)) if variants else 0)

    trim_prices_ab = extract_trim_prices_ab(text)
    wltp = extract_wltp(text)

    price_from = min((v['priceGross'] for v in variants), default=None)

    return {
        'brand': 'Kia',
        'modelKey': meta['modelKey'],
        'model': meta['model'],
        'powertrainVariant': meta['variant'],
        'sourceFile': stem + '.pdf',
        'sourcePdfPath': f'Kia-Germany/{stem}.pdf',
        'priceListSource': 'Kia Deutschland GmbH – offizielle Preisliste PDF',
        'importedAt': '2026-05-29',
        'priceFromGross': price_from,
        'trims': [{'id': slug(t), 'name': t} for t in trims],
        'variants': variants,
        'trimPricesFrom': trim_prices_ab,
        'wltpNotes': wltp,
        'variantCount': len(variants),
    }


def apply_manual_supplement(data: dict, supplement: dict) -> dict:
    if not supplement:
        return data
    merged = {**data}
    if supplement.get('variants'):
        merged['variants'] = supplement['variants']
        merged['variantCount'] = len(supplement['variants'])
        merged['priceFromGross'] = min(v['priceGross'] for v in supplement['variants'])
    if supplement.get('trims'):
        merged['trims'] = supplement['trims']
    if supplement.get('replace'):
        merged.pop('importNote', None)
    elif supplement.get('note'):
        merged['importNote'] = supplement['note']
    merged['manualSupplement'] = True
    return merged


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    supplements_path = OUT_DIR / 'manual-supplements.json'
    supplements = {}
    if supplements_path.exists():
        supplements = json.loads(supplements_path.read_text(encoding='utf-8'))
    index = []
    for stem, meta in FILE_META.items():
        txt_path = EXTRACT_DIR / f'{stem}.txt'
        if not txt_path.exists():
            print('MISSING', txt_path)
            continue
        text = txt_path.read_text(encoding='utf-8')
        data = parse_file(stem, text)
        if meta['modelKey'] in supplements:
            sup = supplements[meta['modelKey']]
            if data['variantCount'] == 0 or sup.get('replace'):
                data = apply_manual_supplement(data, sup)
        elif data['variantCount'] == 0:
            data['importNote'] = 'PDF-Text nicht vollständig parsebar (OCR) – manuelle Nacharbeit'
        out_path = OUT_DIR / f'{meta["modelKey"]}.json'
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        index.append({
            'modelKey': data['modelKey'],
            'model': data['model'],
            'variantCount': data['variantCount'],
            'priceFromGross': data['priceFromGross'],
            'file': out_path.name,
        })
        print(f'{data["modelKey"]}: {data["variantCount"]} variants, from {data["priceFromGross"]} EUR')

    index_path = OUT_DIR / 'index.json'
    index_path.write_text(json.dumps({
        'importedAt': '2026-05-29',
        'sourceDirectory': 'Desktop/clever-neuwagen.de',
        'modelCount': len(index),
        'models': index,
    }, ensure_ascii=False, indent=2), encoding='utf-8')

    catalog = {}
    for item in index:
        key = item['modelKey']
        catalog[key] = json.loads((OUT_DIR / item['file']).read_text(encoding='utf-8'))
    (OUT_DIR / 'catalog.json').write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    js_path = OUT_DIR / 'catalog.js'
    js_path.write_text(
        '// Auto-generated by scripts/parse-kia-pricelists.py – do not edit\n'
        f'export default {json.dumps(catalog, ensure_ascii=False, indent=2)};\n',
        encoding='utf-8',
    )
    print('Wrote catalog.json with', len(catalog), 'models')


if __name__ == '__main__':
    main()
