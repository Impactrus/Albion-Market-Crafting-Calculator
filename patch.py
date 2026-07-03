import re

with open('web/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

def add_pagination(match):
    table_id = match.group(1)
    return match.group(0) + f'''
                    <div class="pagination-controls" style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 15px;">
                        <button id="btn-prev-{table_id}" class="btn btn-sm btn-dark" style="display: flex; align-items: center; gap: 5px;"><i data-lucide="chevron-left" style="width:16px;height:16px;"></i> Poprzednia</button>
                        <span id="indicator-{table_id}" style="font-weight: bold; color: var(--text-primary);">Strona 1 z 1</span>
                        <button id="btn-next-{table_id}" class="btn btn-sm btn-dark" style="display: flex; align-items: center; gap: 5px;">Następna <i data-lucide="chevron-right" style="width:16px;height:16px;"></i></button>
                    </div>'''

content = re.sub(r'<tbody id="(body-(?:prices|profit)-\d+)">.*?</tbody>\s*</table>\s*</div>', add_pagination, content, flags=re.DOTALL)

with open('web/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
