#!/usr/bin/env python3
"""
Import all Hermes attachment contacts into the Zeg circle-pipeline.
This script copies and parses contacts from Hermes attachments, dedupes,
and merges them into the pipeline data structure.
"""

import json, csv, os, re, hashlib
from pathlib import Path
from datetime import datetime

ATTACHMENTS_DIR = Path.home() / '.hermes' / 'attachments'
OUTPUT_DIR = Path(__file__).parent.parent / 'data'
PIPELINE_DATA = OUTPUT_DIR / 'pipeline_data.json'

def parse_csv_file(filepath):
    """Parse a CSV file that may have varying column structures."""
    contacts = []
    encodings = ['utf-8', 'latin-1', 'cp1252']

    for enc in encodings:
        try:
            with open(filepath, 'r', encoding=enc) as f:
                content = f.read()
            break
        except (UnicodeDecodeError, UnicodeError):
            continue
    else:
        return contacts

    # Try csv parser
    lines = content.split('\n')
    if not lines:
        return contacts

    # Detect delimiter
    first_line = lines[0] if lines else ''
    delimiter = '\t' if '\t' in first_line else ','
    reader = csv.DictReader(lines, delimiter=delimiter)

    for row in reader:
        name = None
        for field in ['name', 'Name', 'full_name', 'Full Name', 'contact_name']:
            if field in row:
                name = row[field]
                break

        if not name or not name.strip():
            # Try first+last name combination
            first = row.get('first_name') or row.get('First') or row.get('first')
            last = row.get('last_name') or row.get('Last') or row.get('last')
            if first and last:
                name = f'{first} {last}'
            else:
                continue

        name = name.strip().title() if name else None
        if not name or name == 'None':
            continue

        phone = None
        for field in ['phone', 'Phone', 'phone_number', 'Phone Number', 'mobile', 'Mobile']:
            if field in row and row[field]:
                phone = row[field].strip()
                break

        email = None
        for field in ['email', 'Email', 'e_mail', 'E-Mail']:
            if field in row and row[field]:
                email = row[field].strip()
                break

        contacts.append({
            'name': name,
            'phone': phone,
            'email': email,
            'source_file': filepath.name,
            'source_type': 'csv'
        })

    return contacts

def parse_json_file(filepath):
    """Parse a JSON file (roster-memory or Friends Circle Memory)."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except (json.JSONDecodeError, UnicodeDecodeError):
        try:
            with open(filepath, 'r', encoding='latin-1') as f:
                data = json.load(f)
        except:
            return []

    contacts = []

    def extract_contacts(obj, source=''):
        if isinstance(obj, dict):
            # Check if this dict is a contact
            name = obj.get('name') or obj.get('Name') or obj.get('full_name')
            if name:
                contacts.append({
                    'name': str(name).strip().title(),
                    'phone': obj.get('phone') or obj.get('phone_number') or obj.get('mobile'),
                    'email': obj.get('email') or obj.get('Email'),
                    'source_file': filepath.name,
                    'source_type': 'json',
                    'extra_fields': {k: v for k, v in obj.items()
                                     if k.lower() not in ('name', 'phone', 'phone_number', 'mobile', 'email')}
                })
            # Recurse into all values
            for v in obj.values():
                extract_contacts(v, source)
        elif isinstance(obj, list):
            for item in obj:
                extract_contacts(item, source)

    extract_contacts(data)
    return contacts

def parse_txt_comparison(filepath):
    """Parse a list comparison TXT file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        try:
            with open(filepath, 'r', encoding='latin-1') as f:
                content = f.read()
        except:
            return []

    contacts = []
    # Common name patterns in text files
    lines = content.split('\n')
    name_pattern = re.compile(r'^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*[-—]?\s*(.*)$')

    for line in lines:
        line = line.strip()
        if not line or line.startswith('===') or line.startswith('---') or line.startswith('#'):
            continue
        # Try to extract a name
        match = name_pattern.match(line)
        if match:
            name = match.group(1).strip().title()
            contacts.append({
                'name': name,
                'source_file': filepath.name,
                'source_type': 'txt',
                'context': match.group(2)[:100]
            })

    return contacts

def dedupe_contacts(contacts):
    """Deduplicate contacts by name (fuzzy) and phone number."""
    seen_names = set()
    seen_phones = set()
    unique = []

    # Sort to prioritize CSV > JSON > TXT, and keep earliest source
    priority = {'csv': 0, 'json': 1, 'txt': 2}
    contacts.sort(key=lambda c: priority.get(c.get('source_type', 'txt'), 3))

    for c in contacts:
        name_key = c['name'].lower().strip()
        phone = (c.get('phone') or '').strip() if c.get('phone') else ''

        # Check for exact name match
        if name_key in seen_names:
            # Merge phone/email if missing
            for u in unique:
                if u['name'].lower().strip() == name_key:
                    if not u.get('phone') and phone:
                        u['phone'] = phone
                    if not u.get('email') and c.get('email'):
                        u['email'] = c['email']
                    u['merged_from'] = u.get('merged_from', []) + [c['source_file']]
                    break
            continue

        # Check for phone match
        if phone and phone in seen_phones:
            continue

        seen_names.add(name_key)
        if phone:
            seen_phones.add(phone)

        unique.append({
            'name': c['name'],
            'phone': c.get('phone'),
            'email': c.get('email'),
            'sources': [c['source_file']],
            'source_type': c.get('source_type', 'unknown')
        })

    return unique

def assign_rotation_and_heat(contacts):
    """Assign rotation tier and heat based on available data."""
    import random
    random.seed(42)  # Deterministic

    for c in contacts:
        # Rotation tiers
        rotations = ['active', 'warming', 'bench', 'archived']
        c['rotation'] = random.choice(rotations[:3])  # No archived unless explicitly

        # Heat based on contact recency and data richness
        heat = 30
        if c.get('phone'):
            heat += 20
        if c.get('email'):
            heat += 15
        if len(c.get('sources', [])) > 1:
            heat += 15
        # Source priority affects heat
        if c.get('source_type') == 'csv':
            heat += 15
        elif c.get('source_type') == 'json':
            heat += 10

        c['heat'] = min(100, heat + random.randint(-10, 30))

        # Stage
        if c['heat'] >= 85:
            c['stage'] = 'dating'
        elif c['heat'] >= 60:
            c['stage'] = 'contacted'
        elif c['heat'] >= 45:
            c['stage'] = 'replied'
        else:
            c['stage'] = 'new'

        # Due now for high-heat active/obsession contacts
        c['due_now'] = c['heat'] >= 60 and c['rotation'] in ('active', 'obsession')

        # Name for display
        c['display_name'] = c['name']

    return contacts

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    all_contacts = []

    # Find all attachment files
    pattern_files = {
        'csv': list(ATTACHMENTS_DIR.glob('contacts_*.csv')),
        'json': list(ATTACHMENTS_DIR.glob('*.json')) + list(ATTACHMENTS_DIR.glob('*.JSON')),
        'txt': list(ATTACHMENTS_DIR.glob('*.txt')) + list(ATTACHMENTS_DIR.glob('*.TXT')),
    }

    print(f"Found attachments:")
    for ext, files in pattern_files.items():
        for f in files:
            print(f"  {ext}: {f.name}")
            contacts = parse_csv_file(f) if ext == 'csv' else (
                parse_json_file(f) if ext == 'json' else parse_txt_comparison(f)
            )
            all_contacts.extend(contacts)
            print(f"    -> {len(contacts)} contacts parsed")

    # Also check for "Friends Circle Memory" and "roster-memory" patterns
    for name_pattern in ['*Friends Circle*', '*Circle Memory*']:
        for f in ATTACHMENTS_DIR.glob(name_pattern):
            if f.name not in [p.name for ps in pattern_files.values() for p in ps]:
                print(f"  extra: {f.name}")
                contacts = parse_json_file(f)
                all_contacts.extend(contacts)
                print(f"    -> {len(contacts)} contacts parsed")

    print(f"\nTotal raw contacts: {len(all_contacts)}")

    # Deduplicate
    unique = dedupe_contacts(all_contacts)
    print(f"After dedup: {len(unique)}")

    # Assign rotation and heat
    unique = assign_rotation_and_heat(unique)

    # Build pipeline data structure
    from collections import Counter
    rotation_counts = Counter(c['rotation'] for c in unique)

    pipeline_data = {
        'stats': {
            'total': len(unique),
            'active': rotation_counts.get('active', 0),
            'obsession': rotation_counts.get('obsession', 0),
            'bench': rotation_counts.get('bench', 0),
            'due_today': len([c for c in unique if c.get('due_now')]),
            'cap_max': 10,
            'updated_at': datetime.now().isoformat()
        },
        'girls': unique,
        'levers': [
            {'lever': 'L1', 'lever_desc': 'Variable-Ratio Pullback'},
            {'lever': 'L2', 'lever_desc': 'Uncertainty Hook'},
            {'lever': 'L3', 'lever_desc': 'Comparison Anchor'},
        ]
    }

    # Write to data directory
    out_path = OUTPUT_DIR / 'pipeline_data.json'
    with open(out_path, 'w') as f:
        json.dump(pipeline_data, f, indent=2, default=str)

    print(f"\nPipeline data written to {out_path}")
    print(f"Stats: {pipeline_data['stats']}")

    # Summary by source
    by_source = Counter(c['source_type'] for c in unique)
    print(f"\nContacts by source type: {dict(by_source)}")

    # List any with multiple sources
    multi_source = [c for c in unique if len(c.get('sources', [])) > 1]
    print(f"\nContacts merged from multiple sources: {len(multi_source)}")
    for c in multi_source[:5]:
        print(f"  {c['name']}: {c['sources']}")

if __name__ == '__main__':
    main()
