import json
from pathlib import Path
import shutil

from planning import demo_data

root = Path(__file__).resolve().parent
output = root / 'docs'
output.mkdir(exist_ok=True)
html = (root / 'index.html').read_text()
html = html.replace('href="/styles.css"', 'href="./styles.css"')
html = html.replace('<script type="module" src="/app.js"></script>', '<script src="./local-engine.js"></script>\n  <script type="module" src="./app.js"></script>')
html = html.replace('ذخیره‌سازی محلی', 'ذخیره در همین مرورگر')
html = html.replace('نسخهٔ تحلیلی · فضای محلی', 'نسخهٔ مرورگری · GitHub Pages')
(output / 'index.html').write_text(html)
for name in ['app.js', 'styles.css', 'local-engine.js', 'forecast-reports.js', 'planning-v2.js', 'backtest.js', 'input-contract.js', 'scenarios.js', 'extraction-contract.json']:
    shutil.copyfile(root / name, output / name)
(output / 'demo-data.json').write_text(json.dumps(demo_data(), ensure_ascii=False, separators=(',', ':')))
(output / '.nojekyll').touch()
print('GitHub Pages files prepared in docs/ (demo data only).')
