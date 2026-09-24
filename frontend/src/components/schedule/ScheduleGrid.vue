<script setup lang="ts">
import { computed } from 'vue'
import type { AssignmentType, DayDtoType, EmployeeType } from '@/types'

interface ScheduleGridProps {
  employees: EmployeeType[]
  days: DayDtoType[]
  assignments: AssignmentType[]
}

const props = defineProps<ScheduleGridProps>()

const emit = defineEmits<{
  (e: 'cell-click', employeeId: string, date: string): void
}>()

const assignmentByKey = computed(() => {
  const map = new Map<string, AssignmentType>()
  for (const assignment of props.assignments) {
    map.set(`${assignment.employeeId}|${assignment.date}`, assignment)
  }
  return map
})

function cellLabel(employeeId: string, date: string) {
  const assignment = assignmentByKey.value.get(`${employeeId}|${date}`)
  if (!assignment) return ''
  const day = props.days.find((d) => d.date === date)
  const shift = day?.shifts.find((s) => s.id === assignment.shiftId)
  return `${shift?.label ?? assignment.shiftId} (${assignment.role})`
}

function handleClick(employeeId: string, date: string) {
  emit('cell-click', employeeId, date)
}
</script>

<template>
  <div class="schedule-grid">
    <table>
      <thead>
        <tr>
          <th></th>
          <th v-for="day in days" :key="day.date" :class="{ 'schedule-grid__closed-day': day.isClosed }">
            {{ day.date }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="employee in employees" :key="employee.id">
          <th>{{ employee.name }}</th>
          <td
            v-for="day in days"
            :key="day.date"
            :class="{ 'schedule-grid__closed-day': day.isClosed, 'schedule-grid__filled': cellLabel(employee.id, day.date) }"
            @click="!day.isClosed && handleClick(employee.id, day.date)"
          >
            {{ cellLabel(employee.id, day.date) }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped lang="scss">
.schedule-grid {
  overflow-x: auto;

  table {
    border-collapse: collapse;
    width: 100%;
  }

  th,
  td {
    border: 1px solid rgba(0, 0, 0, 0.12);
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    white-space: nowrap;
    text-align: left;
  }

  td {
    cursor: pointer;
  }

  &__closed-day {
    background-color: rgba(0, 0, 0, 0.05);
    cursor: default;
  }

  &__filled {
    background-color: rgba($positive, 0.15);
  }
}
</style>
