<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const authStore = useAuthStore()
const { isAuthenticated } = storeToRefs(authStore)
</script>

<template>
  <q-layout view="lHh Lpr lFf">
    <q-header v-if="isAuthenticated" elevated>
      <q-toolbar>
        <q-toolbar-title>{{ t('app.name') }}</q-toolbar-title>
        <q-btn flat :to="{ name: 'employees' }" :label="t('employees.title')" />
        <q-btn flat :to="{ name: 'month-config' }" :label="t('monthConfig.title')" />
        <q-btn flat :to="{ name: 'requests' }" :label="t('requests.title')" />
        <q-btn flat :to="{ name: 'schedule' }" :label="t('schedule.title')" />
        <q-btn flat :label="t('common.logout')" @click="authStore.logout" />
      </q-toolbar>
    </q-header>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>
