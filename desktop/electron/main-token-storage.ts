import type { IApiTokenStorage, TokenMainSavedData } from "~ims-app-base/logic/managers/ApiWorker";
import { storageGetKey, storageSetKey } from "./storage";
import { privateStorageDeleteKey, privateStorageGetKey, privateStorageSetKey } from "./private-storage";
import { ipcMain } from "electron";

let CurrentRefreshToken: string | undefined | null = null;
let MainTokenData: TokenMainSavedData = {
    userId: undefined,
    accessToken: undefined,
    remember: true
}

const MainTokenStorage: IApiTokenStorage = {
    getMain: function (): TokenMainSavedData {
        return MainTokenData;
    },
    getRefreshToken: async function (): Promise<string | undefined> {
        if (CurrentRefreshToken !== null) {
        return CurrentRefreshToken;
        }
        const auth_data = await storageGetKey<Partial<{userId: string}>>("auth")
        if (!auth_data || !auth_data.userId) {
            CurrentRefreshToken = undefined;
            return undefined;
        }
        const private_data = await privateStorageGetKey<Partial<{refreshToken: string}>>(auth_data.userId, 'auth');
        CurrentRefreshToken = private_data ? private_data.refreshToken : undefined;
        return CurrentRefreshToken;
    },
    save: async function (main: TokenMainSavedData, refreshToken: string | undefined): Promise<void> {
        MainTokenData = main
        const main_user_id = main.userId;
        
        let clear = !main_user_id || !main.accessToken || !refreshToken;
        if (clear){
            await this.clear();
        }
        if (clear || !main_user_id){
            return;
        }
        if (CurrentRefreshToken !== refreshToken){
            CurrentRefreshToken = refreshToken;
            if (main.remember){
                await storageSetKey<Partial<{userId: string}>>("auth", {
                    userId: main_user_id
                })
                await privateStorageSetKey<Partial<{refreshToken: string, accessToken: string}>>(main_user_id, 'auth', {
                  refreshToken,
                  accessToken: main.accessToken
                });
            }
        }
    },
    clear: async function (): Promise<void> {
        CurrentRefreshToken = undefined;
        const auth_data = await storageGetKey<Partial<{userId: string}>>("auth")
        await storageSetKey('auth', null);
        if (auth_data && auth_data.userId){
            await privateStorageDeleteKey(auth_data.userId, 'auth');
        }
    }
}

export async function initMainTokenStorage(){
    ipcMain.on('imsTokenGetMain', (event) => {
        event.returnValue = MainTokenStorage.getMain();
    })
    ipcMain.handle('imsTokenClear', async () => {
        await MainTokenStorage.clear();
    })
    ipcMain.handle('imsTokenGetRefreshToken', async () => {
        return await MainTokenStorage.getRefreshToken();
    })
    ipcMain.handle('imsTokenSave', async (event, {main, token}) => {
        await MainTokenStorage.save(main, token);
    })
    
    const auth = await storageGetKey<Partial<{userId: string}>>("auth")
    if (auth && auth.userId){
        const private_data = await privateStorageGetKey<Partial<{refreshToken: string, accessToken: string}>>(auth.userId, 'auth');
        CurrentRefreshToken = private_data ? private_data.refreshToken : undefined;
        MainTokenData.userId = auth.userId
        MainTokenData.accessToken = private_data ? private_data.accessToken : undefined;
    }
}

export function getMainTokenStorage(){
    return MainTokenStorage;
}