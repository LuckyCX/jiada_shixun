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
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minRows?: number;
};

export default function RichTextEditor({ value, onChange, placeholder, disabled, minRows = 10 }: RichTextEditorProps) {
  const minHeight = `${minRows * 1.5}em`;

  return (
    <div className="rich-text-editor rounded-lg border border-gray-200 overflow-hidden">
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
          const root = editor.editing.view.document.getRoot();
          if (!root) return;
          editor.editing.view.change((writer) => {
            writer.setStyle('min-height', minHeight, root);
          });
        }}
        onChange={(_, editor) => onChange(sanitizeRichText(editor.getData()))}
      />
    </div>
  );
}
