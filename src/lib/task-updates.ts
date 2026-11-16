export const taskUpdatedEvent = "nai:pgr-task-updated";

export function notifyTaskUpdated() {
  window.dispatchEvent(new Event(taskUpdatedEvent));
}
