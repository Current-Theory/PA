import { addDays } from '../lib/dates';
import type { Task } from '../lib/model';

export function seedTasks(today: string): Task[] {
  const make = (id: string, title: string, fields: Partial<Task>): Task => ({
    id, provider: 'mock', providerTaskId: id, title, notes: '', status: 'notStarted',
    priority: 'normal', dueDate: null, createdAt: `${addDays(today, -5)}T09:00:00`,
    completedAt: null, workstream: 'Programme Delivery', sourceType: 'Manual',
    sourceName: 'Quick capture', checklist: [], resources: [], waitingFor: '',
    followUpDate: null, completionNote: '', focusDate: null, ...fields
  });
  return [
    make('sample-1', 'Review Year 3 assessment wording', {
      workstream: 'Assessment & Content', priority: 'high', dueDate: today, focusDate: today,
      status: 'inProgress', sourceType: 'Teams', sourceName: 'Electrical Delivery Meeting (sample)',
      notes: 'Raised during the sample delivery meeting. Cross-check the wording against programme requirements, then send a recommendation to the content team.',
      checklist: [
        { id: 'c1', title: 'Review the assessment handbook', completed: true },
        { id: 'c2', title: 'Cross-check programme requirements', completed: false },
        { id: 'c3', title: 'Draft the recommended wording', completed: false }
      ]
    }),
    make('sample-2', 'Send apprentice handbook corrections to Marketing', {
      workstream: 'Assessment & Content', sourceType: 'Outlook', sourceName: 'Re: Handbook review (sample)',
      focusDate: today, dueDate: today, notes: 'Consolidate the editorial changes into one clear response. This is a fictional task for trying the workflow.',
      checklist: [{ id: 'c4', title: 'Check the final corrections', completed: false }, { id: 'c5', title: 'Send to Marketing', completed: false }]
    }),
    make('sample-3', 'Confirm LMS migration milestone', {
      workstream: 'LMS / Digital', sourceType: 'Planner', sourceName: 'Digital delivery · Migration plan (sample)',
      priority: 'high', dueDate: addDays(today, 1), focusDate: today,
      notes: 'Confirm the content freeze and pilot dates before the next programme update.'
    }),
    make('sample-4', 'Prepare exam support pack requirements', {
      dueDate: today, sourceType: 'To Do', sourceName: 'Programme delivery list (sample)',
      notes: 'Outline the required resources and agree the review process.'
    }),
    make('sample-5', 'Review EWRB regulatory update', {
      workstream: 'Regulatory & Quality', priority: 'high', dueDate: addDays(today, -2),
      sourceType: 'Outlook', sourceName: 'Regulatory update (sample)',
      resources: [{ id: 'r1', title: 'EWRB website', url: 'https://www.ewrb.govt.nz/' }]
    }),
    make('sample-6', 'Follow up provider enrolment query', {
      workstream: 'Providers & Stakeholders', status: 'waiting', waitingFor: 'Provider support team',
      followUpDate: today, dueDate: addDays(today, 2), sourceType: 'Outlook', sourceName: 'Re: Re-enrolment process (sample)',
      notes: 'Waiting for confirmation of the revised process. Follow up if no reply by the indicated date.'
    }),
    make('sample-7', 'Waiting on ID team for Moodle update', {
      workstream: 'LMS / Digital', status: 'waiting', waitingFor: 'Instructional design team',
      followUpDate: addDays(today, 2), sourceType: 'Teams', sourceName: 'Digital learning catch-up (sample)',
      notes: 'The team is reviewing the navigation proposal.'
    }),
    make('sample-8', 'Prepare next delivery meeting agenda', {
      dueDate: addDays(today, 3), sourceType: 'Planner', sourceName: 'Programme operations plan (sample)'
    }),
    make('sample-9', 'Map the next programme review milestones', {
      workstream: 'Projects', dueDate: addDays(today, 7), priority: 'normal'
    }),
    make('sample-10', 'Explore a simpler provider onboarding checklist', {
      workstream: 'Ideas / Improvements', dueDate: addDays(today, 12), priority: 'low'
    }),
    make('sample-11', 'Confirm handbook review schedule', {
      status: 'completed', workstream: 'Assessment & Content', sourceType: 'Outlook',
      sourceName: 'Handbook planning (sample)', completedAt: `${addDays(today, -1)}T14:30:00`,
      completionNote: 'Agreed the review sequence and shared the schedule with the content team.',
      notes: 'Retain the agreed sequence as context for the next review.'
    }),
    make('sample-12', 'Update programme delivery action register', {
      status: 'completed', completedAt: `${addDays(today, -3)}T11:15:00`,
      sourceType: 'Planner', sourceName: 'Programme operations plan (sample)',
      completionNote: 'All meeting actions assigned and due dates confirmed.'
    })
  ];
}
