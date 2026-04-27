import { defineAsyncComponent } from "vue";
import ApiManager from "~ims-app-base/logic/managers/ApiManager";
import { HttpMethods, Service, type AuthTokenInfo } from "~ims-app-base/logic/managers/ApiWorker";
import AuthManager, { type AvatarEntity } from "~ims-app-base/logic/managers/AuthManager";
import DialogManager from "~ims-app-base/logic/managers/DialogManager";
import type { IAppManager } from "~ims-app-base/logic/managers/IAppManager";
import { EntityCache } from "~ims-app-base/logic/types/EntityCache";
import assert from 'assert';
import type { ProjectLicense } from "~ims-app-base/logic/types/ProjectTypes";




export default class DesktopAuthManager extends AuthManager{
    private readonly _apiManager: ApiManager;
    private _avatarsCache: EntityCache<AvatarEntity> | undefined;
    private _avatarReloadEpoch: number = 0;

    constructor(app_manager: IAppManager) {
        super(app_manager);
        this._apiManager = app_manager.get(ApiManager);
    }

    async init() {
        const user_info = this._apiManager.getTokenInfo();
        if (user_info) {
            await this._apiManager.ensureValidTokenInfo();
        }
        this._avatarsCache = new EntityCache<AvatarEntity>({
            key: 'id',
            ttl: 1000 * 60 * 10,
            loadFunc: async (userIds) => {
                assert(this._avatarsCache, 'Not inited');

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
                for (const userId of userIds) {
                    const ent: AvatarEntity = {
                        id: userId,
                        hasAvatar: haveIdsSet.has(parseInt(userId)),
                    };
                    all_avatars.push(ent);
                }
                this._avatarsCache.addToCacheMany(all_avatars);
                return all_avatars;
            },
        });
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

    override async getAvatar(user_id: string, size: number): Promise<string | null> {
        assert(this._avatarsCache);
        const res = await this._avatarsCache.getElement(user_id);
        if (!res || !res.hasAvatar) return null;
        return (
        `${this.appManager.$env.AUTH_API_HOST ?? '/'}auth/avatar/${size}/${user_id}` +
        (this._avatarReloadEpoch ? '?' + this._avatarReloadEpoch : '')
        );
    }

    override getAvatarSync(user_id: string, size: number): string | null | undefined {
        assert(this._avatarsCache);
        const res = this._avatarsCache.getElementSync(user_id);
        if (!res) return res;
        if (!res.hasAvatar) return null;
        return (
        `${this.appManager.$env.AUTH_API_HOST ?? '/'}auth/avatar/${size}/${user_id}` +
        (this._avatarReloadEpoch ? '?' + this._avatarReloadEpoch : '')
        );
    }

    async getUserLicense(): Promise<{
        list: ProjectLicense[];
        total: number;
      }
    >
    {
        return await this.appManager
        .get(ApiManager)
        .call(Service.CREATORS, HttpMethods.GET, 'license/user');
    }

}