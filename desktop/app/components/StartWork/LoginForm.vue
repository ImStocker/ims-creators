<template>
  <div class="AuthForm LoginForm">
    <div class="AuthForm-header">{{ $t('auth.signInHeader') }}</div>
    <div v-if="message" class="AuthForm-message">
      {{ message }}
    </div>
    <div class="AuthForm-content">
      <FormInput
        :placeholder="'Email'"
        :type="'text'"
        :value="mail"
        name="email"
        @input="mail = $event"
      />
      <FormInput
        :placeholder="$t('auth.password')"
        :value="password"
        type="password"
        name="password"
        @input="password = $event"
      />
      <FormCheckBox :value="isRemember" @input="isRemember = $event">
        {{ $t('auth.rememberMe') }}
      </FormCheckBox>
    </div>
    <div class="AuthForm-additional">
      <a href="https://imsc.space/app/restore"
        class="AuthForm-links AuthForm-yellow-link"
        :target="openExternal ? '_blank' : undefined">
        {{ $t('auth.forgotPasswordLink') }}
      </a>
      <button
        type="button"
        class="is-button is-button-action accent"
        :disabled="inProcess"
        :class="{ loading: inProcess }"
        @click="login()"
      >
        {{ $t('auth.signInButton') }}
      </button>
    </div>
    <div class="AuthForm-additional-request use-buttons-action">
      <button
        v-if="showRequestButton"
        type="button"
        class="is-button accent"
        :disabled="inProcess"
        @click="requestNewCode()"
      >
        {{ $t('auth.requestNewConfirmationCode') }}
      </button>
    </div>
    <div class="AuthForm-registration">
      <div>
        {{ $t('auth.noAccount') }}
      </div>
      <a href="https://imsc.space/app/sign-up"
        class="AuthForm-yellow-link"
        :target="openExternal ? '_blank' : undefined">
        {{ $t('auth.signUpHereLink') }}
      </a>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import FormInput from '~ims-app-base/components/Form/FormInput.vue';
import FormCheckBox from '~ims-app-base/components/Form/FormCheckBox.vue';
import DesktopUiManager from '#logic/managers/DesktopUiManager';
import AuthManager from '~ims-app-base/logic/managers/AuthManager';
export default defineComponent({
  name: 'LoginForm',
  components: {
    FormInput,
    FormCheckBox,
  },
  props: {
    message: {
      type: String,
      default: '',
    },
    openExternal: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['successLogin', 'completeRegistration', 'showRegister'],
  data() {
    return {
      mail: '',
      password: '',
      isRemember: true,
      inProcess: false,
      showRequestButton: false,
    };
  },
  computed: {
    userInfo() {
      return this.$getAppManager().get(AuthManager).getUserInfo();
    },
  },
  methods: {
    async login() {
      this.inProcess = true;
      if (this.mail.length > 0) {
        if (this.password.length > 0) {
          await this.$getAppManager()
            .get(DesktopUiManager)
            .doTask(async () => {
              const res = await this.$getAppManager()
                .get(AuthManager)
                .login(this.mail, this.password, 'site', this.isRemember);
              if (res.notConfirmed) {
                this.$getAppManager()
                  .get(DesktopUiManager)
                  .showError(this.$t('auth.needConfirmEmail'));
                this.showRequestButton = true;
              } else if (res.missingName || res.missingEmail) {
                this.$getAppManager()
                  .get(DesktopUiManager)
                  .showError(this.$t('auth.needCompleteRegistration'));
                this.$emit('completeRegistration', {
                  missingName: res.missingName,
                  missingEmail: res.missingEmail,
                });
              } else {
                this.$emit('successLogin');
                this.showRequestButton = false;
              }
            });
        } else {
          this.$getAppManager()
            .get(DesktopUiManager)
            .showError(
              this.$t('auth.errors.fieldIsEmpty', {
                field: this.$t('fields.password'),
              }),
            );
        }
      } else {
        this.$getAppManager()
          .get(DesktopUiManager)
          .showError(this.$t('auth.errors.fieldIsEmpty', { field: 'Email' }));
      }
      this.inProcess = false;
    },
    async requestNewCode() {
      this.inProcess = true;
      await this.$getAppManager()
        .get(DesktopUiManager)
        .doTask(async () => {
          await this.$getAppManager()
            .get(AuthManager)
            .confirmRequest(
              this.password,
              this.userInfo?.language ? this.userInfo.language : 'en',
              this.mail,
            );
          this.$getAppManager()
            .get(DesktopUiManager)
            .showSuccess(this.$t('auth.newConfirmationCodeSent'));
        });
      this.inProcess = false;
    },
  },
});
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
@use '~ims-app-base/style/AuthForm';
@use '~ims-app-base/style/Form';
.AuthForm-additional-request {
  padding-top: 20px;
  display: flex;
  justify-content: right;
}
.AuthForm-message {
  padding: 10px;
  border: 1px solid var(--color-main-yellow);
  border-radius: 4px;
  margin-bottom: 20px;
  text-align: center;
  color: var(--color-main-yellow);
}
.LoginForm{
  max-width: inherit;
}
</style>
