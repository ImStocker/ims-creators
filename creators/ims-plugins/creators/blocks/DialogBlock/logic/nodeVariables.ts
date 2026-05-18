import DialogManager from '~ims-app-base/logic/managers/DialogManager';
import type { IAppManager } from '~ims-app-base/logic/managers/IAppManager';
import type { DialogVariable } from '../editor/DialogBlockController';
import EnterVariableDialog from '../dialogs/EnterVariableDialog.vue';
import { normalizeAssetPropPart } from '~ims-app-base/logic/types/Props';

export async function nodeVariableAdd(
  appManager: IAppManager,
  list: DialogVariable[],
  messages: {
    alreadyExist: string;
  },
  showAutoFill: boolean = false,
  showKindControl: boolean = false,
): Promise<DialogVariable | null> {
  // Refactor: transfer parameters to an object
  const new_param = await appManager
    .get(DialogManager)
    .show(EnterVariableDialog, {
      showAutoFill,
      showKindControl,
      validate: (variable) => {
        const exists = list.some((v) => v.name === variable.name);
        if (exists) {
          throw new Error(messages.alreadyExist);
        }
      },
    });
  if (!new_param) return null;
  return new_param;
}

export async function nodeVariableChange(
  appManager: IAppManager,
  list: DialogVariable[],
  param: DialogVariable,
  messages: {
    alreadyExist: string;
  },
  showAutoFill: boolean = false,
  showKindControl: boolean = false,
): Promise<DialogVariable | null> {
  // Refactor: transfer parameters to an object
  const new_param = await appManager
    .get(DialogManager)
    .show(EnterVariableDialog, {
      showAutoFill,
      showKindControl,
      initial: param,
      validate: (_variable) => {},
    });
  if (!new_param) return null;
  return new_param;
}

export function checkParamsExists<T extends { name: string }>(
  name: string,
  list: T[],
) {
  return list.some((v) => v.name === name);
}

export function guessDuplicatedItemTitle<T extends { name: string }>(
  title: string,
  list: T[],
) {
  const num_match = title.match(/^(.*)(\d+)(\))?$/);
  let guess_prefix: string;
  let guess_num: number;
  let guess_suffix: string;
  if (num_match) {
    guess_prefix = num_match[1];
    guess_num = parseInt(num_match[2]) + 1;
    guess_suffix = num_match[3] ?? '';
  } else {
    guess_prefix = title;
    guess_suffix = '';
    guess_num = 2;
  }
  const last_attempt = guess_num + 1000;
  let guess_title = guess_prefix + guess_num + guess_suffix;
  while (
    checkParamsExists(normalizeAssetPropPart(guess_title), list) &&
    guess_num <= last_attempt
  ) {
    guess_num++;
    guess_title = guess_prefix + guess_num + guess_suffix;
  }
  return guess_title;
}
export async function nodeVariableDuplicate(
  appManager: IAppManager,
  list: DialogVariable[],
  param: DialogVariable,
  messages: {
    alreadyExist: string;
  },
  showAutoFill: boolean = false,
  showKindControl: boolean = false,
): Promise<DialogVariable | null> {
  // Refactor: transfer parameters to an object
  const guessed_title = guessDuplicatedItemTitle(param.title, list);

  const new_param = await appManager
    .get(DialogManager)
    .show(EnterVariableDialog, {
      showAutoFill,
      showKindControl,
      initial: {
        ...param,
        name: normalizeAssetPropPart(guessed_title),
        title: guessed_title,
      },
      validate: (variable) => {
        const exists = checkParamsExists(variable.name, list);
        if (exists) {
          throw new Error(messages.alreadyExist);
        }
      },
    });
  if (!new_param) return null;
  return new_param;
}
