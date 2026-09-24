<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { email as emailRule, required } from '@/validations'

const router = useRouter()
const { t } = useI18n()
const authStore = useAuthStore()

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

async function handleSubmit() {
  loading.value = true
  errorMessage.value = ''
  const success = await authStore.login(email.value, password.value)
  loading.value = false
  if (!success) {
    errorMessage.value = t('auth.login.error')
    return
  }
  router.push({ name: 'employees' })
}
</script>

<template>
  <div class="login-view">
    <q-card class="login-view__card">
      <q-card-section>
        <div class="text-h6">{{ t('auth.login.title') }}</div>
      </q-card-section>
      <q-card-section>
        <q-form @submit.prevent="handleSubmit">
          <q-input
            v-model="email"
            type="email"
            :label="t('auth.login.email')"
            :rules="[required, emailRule]"
          />
          <q-input
            v-model="password"
            type="password"
            :label="t('auth.login.password')"
            :rules="[required]"
          />
          <div v-if="errorMessage" class="login-view__error">{{ errorMessage }}</div>
          <q-btn class="q-mt-md" type="submit" color="primary" :loading="loading" :label="t('auth.login.submit')" />
        </q-form>
      </q-card-section>
      <q-card-section>
        <router-link :to="{ name: 'register' }">{{ t('auth.login.noAccount') }}</router-link>
      </q-card-section>
    </q-card>
  </div>
</template>

<style scoped lang="scss">
.login-view {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;

  &__card {
    width: 100%;
    max-width: 24rem;
  }

  &__error {
    color: $negative;
  }
}
</style>
