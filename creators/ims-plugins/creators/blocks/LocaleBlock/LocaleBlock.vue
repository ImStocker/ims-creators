<template>
  <div v-if="displayMode !== 'print'" class="AssetEditorLocaleBlock">
    <div
      v-if="isLoading"
      class="AssetEditorLocaleBlock-loading loaderSpinner"
    ></div>
    <div
      v-else-if="loadError"
      class="AssetEditorLocaleBlock-error error-message-block"
    >
      {{ loadError }}
    </div>
    <div v-else class="AssetEditorLocaleBlock-content">
      <div class="AssetEditorLocaleBlock-selectLang">
        <div class="AssetEditorLocaleBlock-selectLang-caption">
          {{ $t('localization.language') }}:
        </div>
        <div class="AssetEditorLocaleBlock-selectLang-control">
          <ims-select
            v-model="selectedLanguage"
            class="AssetEditorLocaleBlock-selectLangSelect"
            :options="languageOptions"
            :get-option-label="(o: LanguageOption) => o.search"
            :get-option-key="(o: LanguageOption) => o.name"
            :reduce="(o: LanguageOption) => o.name"
          >
            <template #option-content="{ option }">
              <div class="AssetEditorLocaleBlock-selectLangSelect-option">
                <span
                  class="AssetEditorLocaleBlock-selectLangSelect-optionName"
                >
                  {{ option.name }}
                </span>
                &ndash;
                <span
                  class="AssetEditorLocaleBlock-selectLangSelect-optionTitle"
                >
                  {{ option.title }}
                </span>
                <locale-block-status-icon
                  v-if="option.status"
                  class="AssetEditorLocaleBlock-selectLangSelect-optionStatus"
                  :status="option.status"
                ></locale-block-status-icon>
              </div>
            </template>
          </ims-select>
        </div>
      </div>
      <imc-grid
        v-if="selectedLanguage"
        class="AssetEditorLocaleBlock-table"
        :columns="translationColumns"
        :rows="translationRows"
        :readonly="readonly"
        @change-cells="changeTranslation"
        @enter="persist"
      >
        <template
          v-for="column of translationColumns"
          :key="column.name"
          #[`header-${column.name}`]
        >
          <div
            class="AssetEditorLocaleBlock-table-header-cell"
            :title="
              column.name === 'status' ? $t('localization.table.status') : ''
            "
          >
            {{ column.propTitle }}
          </div>
        </template>
      </imc-grid>
    </div>
  </div>
</template>

<script lang="ts">
import { type PropType, defineComponent } from 'vue';
import type { AssetChanger } from '~ims-app-base/logic/types/AssetChanger';
import {
  makeFormStateFromProps,
  type AssetDisplayMode,
  type ResolvedAssetBlock,
} from '~ims-app-base/logic/utils/assets';
import type { AssetBlockEditorVM } from '~ims-app-base/logic/vm/AssetBlockEditorVM';
import EditorManager from '~ims-app-base/logic/managers/EditorManager';
import ImsSelect from '~ims-app-base/components/Common/ImsSelect.vue';
import {
  type LocaleBlockLocaleField,
  localeMd5AssetPropValue,
  extractLocaleState,
  type LocalBlockLocaleStatus,
  type LocaleBlockStateMetaObjectStatus,
} from './LocaleBlock';
import {
  makeBlockRef,
  normalizeAssetPropPart,
  type AssetPropValue,
} from '~ims-app-base/logic/types/Props';
import ImcGrid from '~ims-app-base/components/ImcGrid/ImcGrid.vue';
import type {
  ImcGridChangeCell,
  ImcGridColumn,
  ImcGridRow,
} from '~ims-app-base/components/ImcGrid/ImcGrid';
import LocaleBlockStatusIcon from './LocaleBlockStatusIcon.vue';

type LanguageOption = {
  title: string;
  name: string;
  search: string;
  status: LocalBlockLocaleStatus | null;
};

type LocalBlockLocaleTranslated = {
  key: string;
  field: LocaleBlockLocaleField;
  value: AssetPropValue;
  status: LocalBlockLocaleStatus;
};

export default defineComponent({
  name: 'LocaleBlock',
  components: {
    ImsSelect,
    ImcGrid,
    LocaleBlockStatusIcon,
  },
  props: {
    assetBlockEditor: {
      type: Object as PropType<AssetBlockEditorVM>,
      required: true,
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    assetChanger: {
      type: Object as PropType<AssetChanger>,
      required: true,
    },
    resolvedBlock: {
      type: Object as PropType<ResolvedAssetBlock>,
      required: true,
    },
    displayMode: {
      type: String as PropType<AssetDisplayMode>,
      default: () => 'normal',
    },
  },
  emits: ['save'],
  data() {
    return {
      selectedLanguage: null as null | string,
      extractedFields: [] as LocaleBlockLocaleField[],
      isLoading: false,
      loadError: null as string | null,
    };
  },
  computed: {
    localeState() {
      return extractLocaleState(this.resolvedBlock);
    },
    possibleLocaleOptions(): string[] {
      return [
        'en-US',
        'zh-CN',
        'ru-RU',
        'fr-FR',
        'es-ES',
        'en-GB',
        'de-DE',
        'pt-BR',
        'en-CA',
        'es-MX',
        'it-IT',
        'ja-JP',
      ];
    },
    languageOptions(): LanguageOption[] {
      return this.possibleLocaleOptions
        .map((locale) => {
          const translated_fields = this.getTranslatedFieldsForLocale(locale);
          let status: LocalBlockLocaleStatus | null = null;
          if (translated_fields.length > 0) {
            let has_empty = false;
            let has_changed = false;
            let has_need_review = false;
            let has_done = false;
            for (const field of translated_fields) {
              if (field.status === 'new') has_empty = true;
              else if (field.status === 'changed') has_changed = true;
              else if (field.status === 'needReview') has_need_review = true;
              else if (field.status === 'done') has_done = true;
            }
            if (has_changed || has_need_review || has_done) {
              if (has_changed) status = 'changed';
              else if (has_empty) status = 'new';
              else if (has_need_review) status = 'needReview';
              else status = 'done';
            }
          }

          const title = this.$t('localization.locales.' + locale);
          return {
            name: locale,
            search: locale + ' ' + title,
            title,
            status,
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title));
    },
    translationColumns(): ImcGridColumn[] {
      return [
        {
          name: 'key',
          differentDefinition: false,
          index: 0,
          multiple: false,
          params: {},
          propKey: 'key',
          propTitle: this.$t('localization.table.key'),
          type: 'localeBlockKey',
          pin: 'left',
          width: 150,
          propName: 'key',
          readonly: true,
        },
        {
          name: 'original',
          differentDefinition: false,
          index: 0,
          multiple: false,
          params: {},
          propKey: 'original',
          propTitle: this.$t('localization.table.original'),
          type: 'text',
          width: 300,
          propName: 'original',
          readonly: true,
        },
        {
          name: 'translated',
          differentDefinition: false,
          index: 0,
          multiple: false,
          params: {},
          propKey: 'translated',
          propTitle: this.$t('localization.table.translated'),
          type: 'text',
          width: 300,
          propName: 'translated',
        },
        {
          name: 'status',
          differentDefinition: false,
          index: 0,
          multiple: false,
          params: {},
          propKey: 'status',
          propTitle: this.$t('localization.table.statusShort'),
          type: 'localeBlockStatus',
          width: 35,
          pin: 'right',
          propName: 'status',
        },
      ];
    },
    translationFields(): LocalBlockLocaleTranslated[] {
      if (!this.selectedLanguage) return [];
      return this.getTranslatedFieldsForLocale(this.selectedLanguage);
    },
    translationRows(): ImcGridRow[] {
      const language = this.selectedLanguage;
      if (!language) return [];
      const rows: ImcGridRow[] = [];
      for (const field of this.translationFields) {
        const translatedPropKey = `${language}\\${field.key}`;
        const checkedPropKey = `__meta\\${field.key}\\locales\\${language}\\checked`;
        const props = {
          key: field.field.localeKey,
          title: field.field.title,
          original: field.field.originalValue,
          [translatedPropKey]: field.value,
          [checkedPropKey]: field.status === 'done',
          status: field.status,
        };
        rows.push({
          id: field.key,
          values: this.translationColumns.map((col) => {
            let propKey = col.propKey;
            if (col.name === 'translated') {
              propKey = translatedPropKey;
            } else if (col.name === 'status') {
              propKey = checkedPropKey;
            }
            return {
              field: {
                ...col,
                type:
                  col.name === 'translated' || col.name === 'original'
                    ? field.field.type
                    : col.type,
                propKey,
              },
              formState: makeFormStateFromProps(props),
            };
          }),
        });
      }
      return rows;
    },
  },
  async mounted() {
    try {
      this.isLoading = true;
      this.extractedFields = await this.extractFields();
    } catch (err: any) {
      this.loadError = err.message;
    } finally {
      this.isLoading = false;
    }
  },
  methods: {
    getTranslatedFieldsForLocale(locale: string): LocalBlockLocaleTranslated[] {
      const res: LocalBlockLocaleTranslated[] = [];
      const locale_vals = this.localeState.hasOwnProperty(locale)
        ? this.localeState[locale]
        : {};
      for (const field of this.extractedFields) {
        const meta = this.localeState.__meta[field.propKey] ?? {
          key: field.localeKey,
          locales: {},
        };
        const meta_locale: LocaleBlockStateMetaObjectStatus =
          meta.locales.hasOwnProperty(locale)
            ? meta.locales[locale]
            : { checked: false, hash: field.originalValueHash };
        let status: LocalBlockLocaleStatus = 'new';
        const translated_value = locale_vals[field.propKey] ?? null;
        if (translated_value) {
          if (meta_locale.hash !== field.originalValueHash) {
            status = 'changed';
          } else if (meta_locale.checked) {
            status = 'done';
          } else {
            status = 'needReview';
          }
        }

        const translated: LocalBlockLocaleTranslated = {
          key: field.propKey,
          field,
          value: translated_value,
          status,
        };
        res.push(translated);
      }

      return res;
    },
    async extractFields(): Promise<LocaleBlockLocaleField[]> {
      const asset = this.assetBlockEditor.assetFull;
      if (!asset) return [];
      const res: LocaleBlockLocaleField[] = [];
      res.push({
        localeKey: 'title',
        propKey: normalizeAssetPropPart('title'),
        type: 'string',
        title: this.$t('fields.title'),
        originalValue: this.assetBlockEditor.assetFull?.title ?? '',
        originalValueHash: await localeMd5AssetPropValue(
          this.assetBlockEditor.assetFull?.title ?? '',
        ),
      });
      const blocks = this.assetBlockEditor.resolveBlocks();
      for (const block of blocks.list) {
        if (!block.name) {
          continue;
        }
        const block_type_definition = this.$getAppManager()
          .get(EditorManager)
          .getBlockTypeDefinition(block.type);
        if (!block_type_definition) continue;
        const fields = block_type_definition.getBlockLocalizableFields(
          asset,
          block,
        );
        for (const field of fields) {
          const localeKey = `${block.name}.${field.localeKey}`;
          res.push({
            localeKey,
            propKey: normalizeAssetPropPart(localeKey),
            title: field.title,
            type: field.type,
            originalValue: block.computed[field.propKey] ?? null,
            originalValueHash: await localeMd5AssetPropValue(
              block.computed[field.propKey] ?? null,
            ),
          });
        }
      }

      return res;
    },
    persist() {
      this.$emit('save');
    },
    changeTranslation(changes: ImcGridChangeCell[]) {
      const language = this.selectedLanguage;
      if (!language) return;
      const op = this.assetChanger.makeOpId();
      for (const change of changes) {
        const translation_field = this.translationFields[change.rowIndex];
        if (!translation_field) continue;
        if (
          change.field?.propName === 'translated' ||
          change.field?.propName === 'status'
        ) {
          this.assetChanger.registerBlockPropsChanges(
            this.resolvedBlock.assetId,
            makeBlockRef(this.resolvedBlock),
            null,
            change.changes,
            op,
          );
          if (change.field?.propName === 'translated') {
            this.assetChanger.setBlockPropKey(
              this.resolvedBlock.assetId,
              makeBlockRef(this.resolvedBlock),
              null,
              `__meta\\${translation_field.field.propKey}\\locales\\${language}\\checked`,
              true,
            );
          }
          this.assetChanger.setBlockPropKey(
            this.resolvedBlock.assetId,
            makeBlockRef(this.resolvedBlock),
            null,
            `__meta\\${translation_field.field.propKey}\\locales\\${language}\\hash`,
            translation_field.field.originalValueHash,
          );
        }
      }
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
.AssetEditorLocaleBlock-selectLangSelect-option {
  display: flex;
  gap: 10px;
}
.AssetEditorLocaleBlock-selectLangSelect-optionName {
  min-width: 40px;
  font-family: monospace;
}
.AssetEditorLocaleBlock-selectLang {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 10px;
}
.AssetEditorLocaleBlock-selectLang-control {
  flex: 1;
}
.AssetEditorLocaleBlock-table-header-cell {
  padding: 5px;
  overflow: hidden;
  white-space: nowrap;
}
</style>
