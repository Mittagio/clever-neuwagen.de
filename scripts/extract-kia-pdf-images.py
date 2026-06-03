#!/usr/bin/env python3
"""Extract hero/default JPGs from Kia Germany PDF pricelists (kia.com)."""
from __future__ import annotations

import json
import urllib.request
from io import BytesIO
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT_ROOT = ROOT / 'public' / 'images' / 'manufacturers' / 'kia'
META_OUT = ROOT / 'src' / 'data' / 'kia' / 'kiaModelImages.json'

BASE_URL = 'https://www.kia.com/content/dam/kwcms/kme/de/de/assets/contents/utility/Preisliste/'

PDF_TO_FOLDER = {
    'Kia-Germany-Picanto_Preisliste.pdf': 'picanto',
    'Kia-Germany-Stonic-Preisliste.pdf': 'stonic',
    'Kia-Germany-XCeed_Pricelist.pdf': 'xceed',
    'Kia-Germany-K4-Preisliste.pdf': 'k4',
    'Kia-Germany-K4-Sportswagon-Preisliste.pdf': 'k4-sportswagon',
    'Kia-Germany-Seltos-Preisliste.pdf': 'seltos',
    'Kia-Germany-Sportage-Preisliste.pdf': 'sportage',
    'Kia-Germany-Sportage-PHEV-Preisliste.pdf': 'sportage',
    'Kia-Germany-Sorento-pricelist.pdf': 'sorento',
    'Kia-Germany-Sorento-Hybrid-pricelist.pdf': 'sorento',
    'Kia-Germany-Sorento-PHEV-Preisliste.pdf': 'sorento',
    'Kia-Germany-EV2-Preisliste.pdf': 'ev2',
    'Kia-Germany-EV3-Preisliste.pdf': 'ev3',
    'Kia-Germany-EV4-Preisliste.pdf': 'ev4',
    'Kia-Germany-EV5-Preisliste.pdf': 'ev5',
    'Kia-Germany-EV5-GT-Preisliste.pdf': 'ev5-gt',
    'Kia-Germany-EV6_Pricelist.pdf': 'ev6',
    'Kia-Germany-EV9-Preisliste.pdf': 'ev9',
    'Kia-Germany-PV5-Passenger-Preisliste.pdf': 'pv5-passenger',
}


def score_image(page_idx: int, width: int, height: int) -> float:
    area = width * height
    ratio = width / height if height else 0
    if page_idx == 0 and ratio < 0.95 and area > 4_000_000:
        return -1
    if height < 280:
        return area * 0.15
    if 1.4 <= ratio <= 3.8 and width >= 1000 and height >= 350:
        return area * 3.0
    if ratio >= 1.15 and width >= 800 and height >= 400:
        return area * 2.0
    if ratio >= 0.75 and width >= 900 and height >= 550:
        return area * 1.2
    if ratio < 1.0:
        return area * 0.35
    return area


def pick_best_image(doc: fitz.Document) -> tuple[dict, int, int, int] | None:
    best = None
    for page_idx in range(doc.page_count):
        for img in doc.get_page_images(page_idx, full=True):
            info = doc.extract_image(img[0])
            width, height = info['width'], info['height']
            scored = score_image(page_idx, width, height)
            if scored < 0:
                continue
            candidate = (scored, page_idx, width, height, info)
            if best is None or candidate[0] > best[0]:
                best = candidate
    if not best:
        return None
    _, page_idx, width, height, info = best
    return info, page_idx, width, height


def download_pdf(filename: str) -> bytes:
    url = BASE_URL + filename
    req = urllib.request.Request(url, headers={'User-Agent': 'Clever-Neuwagen/1.0'})
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def save_jpeg(folder: str, info: dict) -> None:
    out_dir = OUT_ROOT / folder
    out_dir.mkdir(parents=True, exist_ok=True)
    ext = info.get('ext', 'jpeg')
    raw = info['image']
    if ext in ('jpeg', 'jpg'):
        payload = raw
    else:
        from PIL import Image

        img = Image.open(BytesIO(raw)).convert('RGB')
        buf = BytesIO()
        img.save(buf, format='JPEG', quality=88, optimize=True)
        payload = buf.getvalue()
    for name in ('hero.jpg', 'default.jpg'):
        (out_dir / name).write_bytes(payload)


def main() -> None:
    meta: dict[str, dict] = {}
    folder_best: dict[str, float] = {}

    for pdf_name, folder in PDF_TO_FOLDER.items():
        print(f'Fetching {pdf_name} -> {folder}')
        try:
            data = download_pdf(pdf_name)
        except Exception as exc:  # noqa: BLE001
            print(f'  SKIP download failed: {exc}')
            continue
        doc = fitz.open(stream=data, filetype='pdf')
        picked = pick_best_image(doc)
        if not picked:
            print('  SKIP no suitable image')
            continue
        info, page_idx, width, height = picked
        score = score_image(page_idx, width, height)
        prev = folder_best.get(folder, -1)
        if score <= prev:
            print(f'  skip (existing better) page {page_idx} {width}x{height}')
            continue
        save_jpeg(folder, info)
        folder_best[folder] = score
        meta[folder] = {
            'sourcePdf': pdf_name,
            'sourceUrl': BASE_URL + pdf_name,
            'page': page_idx + 1,
            'width': width,
            'height': height,
            'extractedAt': '2026-05-29',
            'hero': f'/images/manufacturers/kia/{folder}/hero.jpg',
            'default': f'/images/manufacturers/kia/{folder}/default.jpg',
        }
        print(f'  OK page {page_idx + 1} {width}x{height}')

    META_OUT.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Wrote {len(meta)} model folders -> {META_OUT}')


if __name__ == '__main__':
    main()
