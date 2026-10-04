import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const content=JSON.parse(fs.readFileSync(path.join(root,'src/features/legal/documents.json'),'utf8'));
const lines=[`# Documente pentru lansare — PROIECT, ${content.updated}`,'',`Versiune: ${content.version}. Sursa unică pentru paginile publice și acest export: src/features/legal/documents.json.`,'',content.notice,'',`Contact operațional: ${content.contact}. Paginile: https://voxa-os.vercel.app/legal.`,'','Fișa furnizorului, anexele și aprobările: [LEGAL_OPERATIONS_RO.md](LEGAL_OPERATIONS_RO.md). Registrul furnizorilor și transferurilor: [PROCESSORS_RO.md](PROCESSORS_RO.md).','','Acest export nu introduce acceptare contractuală sau consent GDPR în aplicație.'];
for(const document of content.documents){
  lines.push('',`## ${document.title}`,'',`Pagina: https://voxa-os.vercel.app/legal/${document.slug}`,'',document.summary);
  for(const section of document.sections){
    lines.push('',`### ${section.title}`);
    for(const paragraph of section.paragraphs)lines.push('',paragraph);
    if(section.items)lines.push('',...section.items.map(item=>`- ${item}`));
    if(section.table){
      const cells=row=>'| '+row.map(cell=>cell.replaceAll('|','\\|')).join(' | ')+' |';
      lines.push('',cells(section.table.columns),cells(section.table.columns.map(()=> '---')),...section.table.rows.map(cells));
    }
  }
  lines.push('','### Surse oficiale','',...document.sources.map(source=>`- [${source.label}](${source.url})`));
}
fs.writeFileSync(path.join(root,'docs/LEGAL_DRAFTS_RO.md'),lines.join('\n')+'\n');
console.log('Legal drafts exported from the same source as the public pages; draft status preserved.');
