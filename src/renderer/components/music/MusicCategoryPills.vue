<template>
  <div class="category-pills-container">
    <div class="category-pills">
      <button
        v-for="category in categories"
        :key="category.id"
        :class="['pill', { active: selected === category.id }]"
        @click="$emit('select', category.id)"
      >
        {{ category.label }}
      </button>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'

export default defineComponent({
  name: 'MusicCategoryPills',

  props: {
    categories: {
      type: Array,
      required: true
    },
    selected: {
      type: String,
      default: ''
    }
  },

  emits: ['select']
})
</script>

<style scoped>
.category-pills-container {
  padding: 8px 20px;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.category-pills-container::-webkit-scrollbar {
  display: none;
}

.category-pills {
  display: flex;
  gap: 8px;
  white-space: nowrap;
}

.pill {
  background-color: #272727;
  border: none;
  border-radius: 8px;
  color: #ffffff;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.pill:hover {
  background-color: #3a3a3a;
}

.pill.active {
  background-color: #ffffff;
  color: #000000;
}
</style>
