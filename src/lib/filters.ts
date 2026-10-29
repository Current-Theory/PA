export interface FiltersState {
  text: string; workstream: string; source: string; priority: string;
  status: string; due: string; completedFrom: string; completedTo: string;
}
export const emptyFilters: FiltersState = { text: '', workstream: '', source: '', priority: '', status: '', due: '', completedFrom: '', completedTo: '' };
