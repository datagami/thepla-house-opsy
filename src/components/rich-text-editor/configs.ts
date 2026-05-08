// Jodit toolbar config for editors that author offer-letter HTML clauses
// (snippet admin + the per-offer Terms & Policies field). The Source button
// lets HR paste the exact <section class="clause"><h3><span class="num-mark">
// NN</span>Title</h3>…</section> structure that the print CSS targets;
// plain WYSIWYG can't insert class="num-mark", so the gold number badge and
// the .terms h3 flex layout don't apply without it.
export const OFFER_HTML_EDITOR_CONFIG = {
  readonly: false,
  height: 570,
  toolbarSticky: false,
  toolbarAdaptive: false,
  showCharsCounter: false,
  showWordsCounter: false,
  showXPathInStatusbar: false,
  askBeforePasteHTML: false,
  askBeforePasteFromWord: false,
  buttons: [
    'source', '|',
    'bold', 'italic', 'underline', 'strikethrough', '|',
    'ul', 'ol', '|',
    'outdent', 'indent', '|',
    'font', 'fontsize', 'brush', 'paragraph', '|',
    'image', 'table', 'link', '|',
    'align', 'undo', 'redo', '|',
    'hr', 'eraser', 'copyformat', '|',
    'fullsize',
  ],
}
