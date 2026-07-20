import { LocaleBlockKeyController } from './LocaleBlockKeyField/LocaleBlockKeyFieldController';
import { LocaleBlockStatusFieldController } from './LocaleBlockStatusField/LocaleBlockStatusFieldController';

export default function () {
  return [
    new LocaleBlockKeyController(),
    new LocaleBlockStatusFieldController(),
  ]
    .filter((el) => el)
    .map((el) => {
      return {
        type: 'field',
        content: {
          controller: el,
        },
      };
    });
}
