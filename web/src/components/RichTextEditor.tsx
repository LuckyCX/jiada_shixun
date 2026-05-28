import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  Alignment,
  Base64UploadAdapter,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  Font,
  GeneralHtmlSupport,
  Heading,
  Image,
  ImageCaption,
  ImageResize,
  ImageStyle,
  ImageToolbar,
  ImageUpload,
  Italic,
  Link,
  List,
  Paragraph,
  PasteFromOffice,
  SourceEditing,
  Strikethrough,
  Table,
  TableCellProperties,
  TableProperties,
  TableToolbar,
  Underline,
} from 'ckeditor5';
import { sanitizeRichText } from '../lib/richText';
import 'ckeditor5/ckeditor5.css';

type RichTextEditorProps = {
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
  fitHeight?: boolean;
  viewOnly?: boolean;
};

export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
  minRows = 10,
  fitHeight = false,
  viewOnly = false,
}: RichTextEditorProps) {
  const minHeight = `${minRows * 1.5}em`;

  if (viewOnly) {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white ${fitHeight ? 'h-full overflow-y-auto' : ''}`}>
        <div
          className="prose max-w-none overflow-x-hidden break-words [&_*]:max-w-full [&_img]:h-auto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_th]:border [&_td]:border [&_th]:border-gray-200 [&_td]:border-gray-200 p-4"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(value) }}
        />
      </div>
    );
  }

  return (
    <div
      className={`rich-text-editor rounded-lg border border-gray-200 overflow-hidden ${
        fitHeight
          ? 'flex flex-col h-full [&_.ck-editor]:flex [&_.ck-editor]:flex-col [&_.ck-editor]:h-full [&_.ck-editor__main]:flex-1 [&_.ck-editor__main]:min-h-0 [&_.ck-editor__editable]:flex-1 [&_.ck-editor__editable]:min-h-0 [&_.ck-editor__editable]:overflow-y-auto'
          : ''
      }`}
    >
      <CKEditor
        editor={ClassicEditor}
        disabled={disabled}
        data={value}
        config={{
          licenseKey: 'GPL',
          plugins: [
            Essentials,
            Paragraph,
            Heading,
            Bold,
            Italic,
            Underline,
            Strikethrough,
            Font,
            Alignment,
            Link,
            List,
            BlockQuote,
            Table,
            TableToolbar,
            TableProperties,
            TableCellProperties,
            Image,
            ImageToolbar,
            ImageCaption,
            ImageStyle,
            ImageResize,
            ImageUpload,
            Base64UploadAdapter,
            PasteFromOffice,
            GeneralHtmlSupport,
            SourceEditing,
          ],
          toolbar: {
            items: [
              'heading',
              '|',
              'bold',
              'italic',
              'underline',
              'strikethrough',
              '|',
              'fontColor',
              'fontBackgroundColor',
              'alignment',
              '|',
              'bulletedList',
              'numberedList',
              'blockQuote',
              '|',
              'link',
              'insertTable',
              'uploadImage',
              '|',
              'sourceEditing',
              'undo',
              'redo',
            ],
            shouldNotGroupWhenFull: false,
          },
          image: {
            toolbar: ['imageTextAlternative', 'toggleImageCaption', 'imageStyle:inline', 'imageStyle:block', 'imageStyle:side'],
          },
          link: {
            addTargetToExternalLinks: true,
            defaultProtocol: 'https://',
          },
          table: {
            contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells', 'tableProperties', 'tableCellProperties'],
          },
          htmlSupport: {
            allow: [
              {
                name: /.*/,
                attributes: true,
                classes: true,
                styles: true,
              },
            ],
          },
          placeholder,
        }}
        onReady={(editor) => {
          if (fitHeight) return;
          const root = editor.editing.view.document.getRoot();
          if (!root) return;
          editor.editing.view.change((writer) => {
            writer.setStyle('min-height', minHeight, root);
          });
        }}
        onChange={(_, editor) => onChange?.(sanitizeRichText(editor.getData()))}
      />
    </div>
  );
}
