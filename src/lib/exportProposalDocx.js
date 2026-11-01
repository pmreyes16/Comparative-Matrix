/**
 * EXPORT — write the generated Proposal document to an editable Word .docx,
 * built from scratch in the browser (pizzip; no template, nothing uploaded).
 * Same sections and wording as the PDF export (exportProposal.js): header,
 * executive summary, recommended insurer, headline winners, additional
 * considerations, the full comparison appendix and the disclaimer.
 */
import PizZip from 'pizzip';
import { nameOf } from './proposal.js';
import { toast, triggerDownload } from './exportMatrix.js';
import { exportProposalFilename } from './exportProposal.js';
import { svgUrlToPng } from './svgAsset.js';
import howdenLogoUrl from '../assets/Howden logo - Corporate.svg';

const COBALT = '0047AB';
const COBALT_DARK = '00337A';
const COBALT_TINT = 'E9F1FB';
const SLATE_900 = '1E293B';
const SLATE_500 = '64748B';
const SLATE_400 = '94A3B8';
const RULE = 'E2E8F0';
const ROSEGOLD = '8C4A54';
const POPPY = 'A81713';

// A4 portrait in twentieths of a point, 42pt margins — matches the PDF.
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 840;
const CONTENT_W = PAGE_W - MARGIN * 2;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One text run; newlines in the text become Word line breaks. */
function run(text, { bold, italic, size = 10, color = SLATE_900, caps } = {}) {
  const props =
    '<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>' +
    (bold ? '<w:b/>' : '') +
    (italic ? '<w:i/>' : '') +
    (caps ? '<w:caps/><w:spacing w:val="20"/>' : '') +
    '<w:color w:val="' + color + '"/><w:sz w:val="' + Math.round(size * 2) + '"/></w:rPr>';
  const parts = String(text == null ? '' : text).split('\n');
  return parts
    .map((t, i) => '<w:r>' + props + (i ? '<w:br/>' : '') + '<w:t xml:space="preserve">' + esc(t) + '</w:t></w:r>')
    .join('');
}

function para(runs, { align, before = 0, after = 0, keepNext, bullet } = {}) {
  const pPr =
    '<w:pPr>' +
    (keepNext ? '<w:keepNext/>' : '') +
    '<w:spacing w:before="' + before + '" w:after="' + after + '" w:line="264" w:lineRule="auto"/>' +
    (bullet ? '<w:ind w:left="240" w:hanging="160"/>' : '') +
    (align ? '<w:jc w:val="' + align + '"/>' : '') +
    '</w:pPr>';
  return '<w:p>' + pPr + (bullet ? run('• ', bullet) : '') + runs + '</w:p>';
}

const kicker = (text, color = SLATE_400) =>
  para(run(text, { bold: true, size: 8, color, caps: true }), { before: 280, after: 120, keepNext: true });

function border(side, color = RULE, sz = 4) {
  return '<w:' + side + ' w:val="single" w:sz="' + sz + '" w:space="0" w:color="' + color + '"/>';
}
const NO_BORDERS =
  '<w:tblBorders>' +
  ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => '<w:' + s + ' w:val="nil"/>').join('') +
  '</w:tblBorders>';

function cell(content, { width, fill, borders, valign, margins } = {}) {
  return (
    '<w:tc><w:tcPr>' +
    (width ? '<w:tcW w:w="' + width + '" w:type="dxa"/>' : '') +
    (borders ? '<w:tcBorders>' + borders + '</w:tcBorders>' : '') +
    (fill ? '<w:shd w:val="clear" w:color="auto" w:fill="' + fill + '"/>' : '') +
    (margins ? '<w:tcMar>' + margins + '</w:tcMar>' : '') +
    (valign ? '<w:vAlign w:val="' + valign + '"/>' : '') +
    '</w:tcPr>' +
    (content || '<w:p/>') +
    '</w:tc>'
  );
}

function table(rows, widths, { borders = NO_BORDERS, cellMar = 0 } = {}) {
  return (
    '<w:tbl><w:tblPr><w:tblW w:w="' + CONTENT_W + '" w:type="dxa"/><w:tblLayout w:type="fixed"/>' +
    borders +
    '<w:tblCellMar><w:top w:w="' + cellMar + '" w:type="dxa"/><w:left w:w="' + (cellMar ? 100 : 0) + '" w:type="dxa"/>' +
    '<w:bottom w:w="' + cellMar + '" w:type="dxa"/><w:right w:w="' + (cellMar ? 100 : 0) + '" w:type="dxa"/></w:tblCellMar>' +
    '</w:tblPr><w:tblGrid>' +
    widths.map((w) => '<w:gridCol w:w="' + w + '"/>').join('') +
    '</w:tblGrid>' +
    rows.join('') +
    '</w:tbl>'
  );
}

function logoDrawing(aspect) {
  const h = 22 * 12700; // 22pt in EMU, same as the PDF header
  const w = Math.round(h * aspect);
  return (
    '<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0">' +
    '<wp:extent cx="' + w + '" cy="' + h + '"/><wp:docPr id="1" name="Howden logo"/>' +
    '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">' +
    '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<pic:nvPicPr><pic:cNvPr id="1" name="logo.png"/><pic:cNvPicPr/></pic:nvPicPr>' +
    '<pic:blipFill><a:blip r:embed="rIdLogo"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>' +
    '<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' + w + '" cy="' + h + '"/></a:xfrm>' +
    '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>' +
    '</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
  );
}

function summaryText(data) {
  if (data.proposals.length < 2) {
    return 'Only one proposal has been uploaded — comparison and recommendation become available once a second quotation slip is added.';
  }
  const recommended = data.recommended;
  return (
    'We compared ' + data.proposals.length + ' proposals' +
    (data.policyType ? ' for ' + data.policyType : '') + '. ' +
    (recommended
      ? 'Based on a balanced view of price, cover and terms, we recommend ' + nameOf(recommended.p) +
        (data.winCount > 0
          ? ' — it leads on ' + data.winCount + ' of the ' + data.winners.length + ' headline criteria below.'
          : ' as the strongest overall balance across price, cover and terms, though no single insurer swept every headline criterion.')
      : '')
  );
}

function buildBody(data, logo) {
  const out = [];
  const recommended = data.recommended;
  const dateStr = data.generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // ---- Header: logo left, preparer + date right ----
  const half = CONTENT_W / 2;
  out.push(
    table(
      [
        '<w:tr>' +
          cell(para(logo ? logoDrawing(logo.aspect) : run('HOWDEN', { bold: true, size: 18, color: COBALT })), { width: half, valign: 'center' }) +
          cell(
            para(run('Prepared by Howden Philippines', { size: 8, color: SLATE_500 }), { align: 'right' }) +
              para(run(dateStr, { size: 8, color: SLATE_500 }), { align: 'right' }),
            { width: half, valign: 'center' }
          ) +
          '</w:tr>',
      ],
      [half, half],
      { borders: '<w:tblBorders>' + border('bottom') + '</w:tblBorders>', cellMar: 80 }
    )
  );

  out.push(para(run('Insurance Placement Recommendation', { bold: true, size: 8, color: COBALT, caps: true }), { before: 320, after: 80 }));
  out.push(para(run(data.insuredName || 'Comparative Insurance Proposal', { bold: true, size: 17 }), { after: 80 }));
  const subtitle = [data.policyType, [data.period.from, data.period.to].filter(Boolean).join(' – ')].filter(Boolean).join('   ·   ');
  if (subtitle) out.push(para(run(subtitle, { size: 10, color: SLATE_500 })));

  // ---- Executive summary ----
  out.push(kicker('Executive Summary'));
  out.push(para(run(summaryText(data), { size: 10 }), { after: 120 }));

  // ---- Recommended insurer callout ----
  if (recommended) {
    const left = Math.round(CONTENT_W * 0.72);
    const right = CONTENT_W - left;
    out.push(para('', { after: 120 }));
    out.push(
      table(
        [
          '<w:tr>' +
            cell(
              para(run('Recommended Insurer', { bold: true, size: 8, color: COBALT, caps: true }), { after: 60 }) +
                para(run(nameOf(recommended.p), { bold: true, size: 14 })),
              { width: left, fill: COBALT_TINT, valign: 'center' }
            ) +
            cell(
              para(run(Math.round(recommended.score) + '/100', { bold: true, size: 20, color: COBALT_DARK }), { align: 'right' }),
              { width: right, fill: COBALT_TINT, valign: 'center' }
            ) +
            '</w:tr>',
        ],
        [left, right],
        { cellMar: 220 }
      )
    );
  }

  // ---- Headline winners ----
  out.push(kicker('Where Each Insurer Leads'));
  const lw = Math.round(CONTENT_W * 0.45);
  const rw = CONTENT_W - lw;
  const winnerRows = data.winners.map((w) => {
    const top = border('top');
    const right = w.p
      ? para(run(nameOf(w.p), { bold: true, size: 10, color: COBALT_DARK }), { align: 'right' }) +
        para(run(String(w.disp || '').replace(/\s*\n\s*/g, '; '), { size: 9, color: SLATE_500 }), { align: 'right' })
      : para(run('Not enough comparable data', { italic: true, size: 9, color: SLATE_400 }), { align: 'right' });
    return (
      '<w:tr><w:trPr><w:cantSplit/></w:trPr>' +
      cell(
        para(run(w.criterion.label, { bold: true, size: 10 })) +
          (w.criterion.hint ? para(run(w.criterion.hint, { size: 8, color: SLATE_400 })) : ''),
        { width: lw, borders: top }
      ) +
      cell(right, { width: rw, borders: top }) +
      '</w:tr>'
    );
  });
  out.push(table(winnerRows, [lw, rw], { cellMar: 110 }));

  // ---- Additional considerations ----
  const hasSecondary = data.secondaryWinners.some((w) => w.p);
  const hasClauses = data.recommendedUniqueClauses.length > 0;
  const hasFlags = data.review.length > 0 || data.lapsed.length > 0;
  if (hasSecondary || hasClauses || hasFlags) {
    out.push(kicker('Additional Considerations'));
    const sub = (t) => para(run(t, { bold: true, size: 9.5 }), { before: 120, after: 60, keepNext: true });
    if (hasSecondary) {
      out.push(sub('Protection adequacy'));
      data.secondaryWinners.forEach((w) => {
        if (!w.p) return;
        const disp = String(w.disp || '').replace(/\s*\n\s*/g, '; ');
        out.push(para(run(w.criterion.label + ': ', { size: 9, color: SLATE_500 }) + run(nameOf(w.p), { bold: true, size: 9 }) + run(' (' + disp + ')', { size: 9, color: SLATE_500 }), { after: 40 }));
      });
    }
    if (hasClauses) {
      out.push(sub('What sets ' + nameOf(recommended.p) + ' apart'));
      data.recommendedUniqueClauses.slice(0, 4).forEach((c) => {
        out.push(para(run(c, { size: 9, color: SLATE_500 }), { after: 40, bullet: { size: 9, color: SLATE_500 } }));
      });
    }
    if (hasFlags) {
      out.push(sub('Before you proceed'));
      data.review.forEach((p) => out.push(para(run(nameOf(p) + ' — figures need manual verification before relying on them.', { size: 9, color: ROSEGOLD }), { after: 40 })));
      data.lapsed.forEach((p) => out.push(para(run(nameOf(p) + ' — quote validity has lapsed; ask for a refreshed quotation.', { size: 9, color: POPPY }), { after: 40 })));
    }
  }

  // ---- Appendix: full comparison detail ----
  const allCriteria = [...data.winners, ...data.secondaryWinners];
  out.push(kicker('Full Comparison Detail'));
  const firstW = 1800;
  const restW = Math.floor((CONTENT_W - firstW) / Math.max(1, allCriteria.length));
  const widths = [firstW, ...allCriteria.map(() => restW)];
  const grid = '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => border(s)).join('') + '</w:tblBorders>';
  const headRow =
    '<w:tr><w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>' +
    ['Insurer', ...allCriteria.map((w) => w.criterion.label)]
      .map((t, i) => cell(para(run(t, { bold: true, size: 8.5, color: 'FFFFFF' })), { width: widths[i], fill: COBALT_DARK }))
      .join('') +
    '</w:tr>';
  const bodyRows = data.ranked.map(
    (r) =>
      '<w:tr><w:trPr><w:cantSplit/></w:trPr>' +
      cell(para(run(nameOf(r.p), { bold: true, size: 8 })), { width: widths[0] }) +
      allCriteria.map((w, i) => cell(para(run(w.criterion.disp(r.p) || '—', { size: 8 })), { width: widths[i + 1] })).join('') +
      '</w:tr>'
  );
  out.push(table([headRow, ...bodyRows], widths, { borders: grid, cellMar: 80 }));

  // ---- Footer disclaimer ----
  out.push(
    para(
      run(
        'This recommendation is auto-generated from figures copied verbatim from each quotation slip. It is a ' +
          'comparison aid, not a binding recommendation or advice — always verify every figure against the original ' +
          'slips before making a decision. Prepared by Howden Philippines.',
        { size: 8, color: SLATE_400 }
      ),
      { before: 360 }
    )
  );

  return out.join('');
}

export async function buildProposalDocxBlob(data) {
  let logo = null;
  try {
    logo = await svgUrlToPng(howdenLogoUrl);
  } catch (e) {
    /* fall back to the text wordmark */
  }

  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Default Extension="png" ContentType="image/png"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '</Types>'
  );
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>'
  );
  zip.file(
    'word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      (logo ? '<Relationship Id="rIdLogo" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.png"/>' : '') +
      '</Relationships>'
  );
  if (logo) zip.file('word/media/logo.png', logo.dataUrl.split(',')[1], { base64: true });

  zip.file(
    'word/document.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"' +
      ' xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">' +
      '<w:body>' +
      buildBody(data, logo) +
      '<w:sectPr><w:pgSz w:w="' + PAGE_W + '" w:h="' + PAGE_H + '"/>' +
      '<w:pgMar w:top="' + MARGIN + '" w:right="' + MARGIN + '" w:bottom="' + MARGIN + '" w:left="' + MARGIN + '" w:header="400" w:footer="400" w:gutter="0"/>' +
      '</w:sectPr></w:body></w:document>'
  );

  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

export async function exportProposalToDocx(data) {
  try {
    const blob = await buildProposalDocxBlob(data);
    triggerDownload(exportProposalFilename(data).replace(/\.pdf$/, '.docx'), blob, true);
    toast('Saved your proposal as a Word document — check your Downloads folder.');
  } catch (e) {
    toast('Sorry — the Word export failed: ' + (e && e.message ? e.message : e));
  }
}
