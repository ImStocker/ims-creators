import { defineAsyncComponent } from "vue";
import ApiManager from "~ims-app-base/logic/managers/ApiManager";
import { HttpMethods, Service, type AuthTokenInfo } from "~ims-app-base/logic/managers/ApiWorker";
import AuthManager, { type AvatarEntity } from "~ims-app-base/logic/managers/AuthManager";
import DialogManager from "~ims-app-base/logic/managers/DialogManager";
import type { IAppManager } from "~ims-app-base/logic/managers/IAppManager";
import type { ProjectLicense } from "~ims-app-base/logic/types/ProjectTypes";
import DesktopSyncManager from "./DesktopSyncManager";




export default class DesktopAuthManager extends AuthManager{
    private readonly _apiManager: ApiManager;

    constructor(app_manager: IAppManager) {
        super(app_manager);
        this._apiManager = app_manager.get(ApiManager);
    }

    override async init() {
        await super.init();
    }

    protected override async loadAvatars(userIds: string[]): Promise<AvatarEntity[]> {
        const res: { haveIds: number[] } = await this._apiManager.call(
            Service.AUTH,
            HttpMethods.POST,
            'auth/avatar/have',
            {
                userIds: userIds.map((u) => parseInt(u)),
            },
        );
        const all_avatars: AvatarEntity[] = [];
        const haveIdsSet = new Set(res.haveIds);
        const host = this.appManager.$env.AUTH_API_HOST ?? '/';
        for (const userId of userIds) {
            const hasAvatar = haveIdsSet.has(parseInt(userId));
            const ent: AvatarEntity = {
                id: userId,
                hasAvatar,
                url: hasAvatar
                    ? (size: number, epoch: number) =>
                          `${host}auth/avatar/${size}/${userId}` +
                          (epoch ? '?' + epoch : '')
                    : (_size: number, _epoch: number) => '',
            };
            all_avatars.push(ent);
        }
        return all_avatars;
    }


    override getUserInfo() {
        return this._apiManager.getTokenInfo();
    }

    async login(email: string, password: string, target = 'site', is_remember: boolean){
        const res: {
            accessToken: string,
            refreshToken: string
        } = await this.appManager
                .get(ApiManager)
                .call(Service.AUTH, HttpMethods.POST, 'auth/login', {
                    email,
                    password,
                    target
                });
        await this._apiManager.setToken(
            res.accessToken,
            res.refreshToken,
            is_remember,
        );
        return res;
    }

    async logout() {
        try {
            const refreshToken = await this._apiManager.getRefreshToken();
            const remember = this._apiManager.getRemember();
            await this._apiManager.call(
                Service.AUTH,
                HttpMethods.POST,
                'auth/logout',
                {
                refreshToken,
                },
            );

            await this._apiManager.setToken(undefined, undefined, remember);
        } finally {
            await this._apiManager.removeToken();
            await this.appManager.get(DesktopSyncManager).pauseSyncProject();
        }
    }

    async confirmRequest(password: string, language: string, email: string){
        await this.appManager
                .get(ApiManager)
                .call(Service.AUTH, HttpMethods.POST, 'auth/confirm', {
                    password,
                    emailOrName: email,
                    language
                });
    }

    async ensureValidUserInfo(): Promise<AuthTokenInfo | undefined> {
        return this._apiManager.ensureValidTokenInfo();
    }

    override async ensureLoggedInDialog(
        message?: string,
    ): Promise<AuthTokenInfo | null> {
        const LoginDialog = defineAsyncComponent(
            () => import('#components/StartWork/LoginDialog.vue'),
        );
        const user = await this.ensureValidUserInfo();
        if (user) {
            return user;
        }
        const res = await this.appManager.get(DialogManager).show(LoginDialog, {
            message,
        });
        if (!res) return null;
        return (await this.ensureValidUserInfo()) ?? null;
    }


    async getUserLicense(): Promise<{
        list: ProjectLicense[];
        total: number;
      }
    >
    {
        if (!this.getUserInfo()){
            return {
                list: [],
                total: 0
            }
        }
        return await this.appManager
        .get(ApiManager)
        .call(Service.CREATORS, HttpMethods.GET, 'license/user');
    }

}