import {App, Modal, Setting, moment} from 'obsidian';

interface EventEditResult {
  title: string;
  eventType: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
}

/**
 * Modal for editing calendar events
 */
export default class EventEditModal extends Modal {
  private result: EventEditResult;
  private onSave: (result: EventEditResult) => void;

  constructor(app: App, event: Model.Event, onSave: (result: EventEditResult) => void) {
    super(app);

    this.onSave = onSave;

    // Initialize with current event values
    this.result = {
      title: event.title,
      eventType: event.eventType && event.eventType !== 'default' ? event.eventType : 'TASK-TODO',
      startDate: new Date(event.start),
      endDate: new Date(event.end),
      allDay: event.allDay,
    };
  }

  onOpen() {
    const {contentEl, titleEl} = this;

    // Set the modal title
    titleEl.setText('Edit Event');

    // Create form container
    const formContainer = contentEl.createDiv({cls: 'event-edit-form'});

    // Event title
    new Setting(formContainer)
      .setName('Title')
      .setDesc('Event title')
      .addText((text) => {
        text.setValue(this.result.title).onChange((value) => {
          this.result.title = value;
        });
      });

    // Event type selector
    new Setting(formContainer)
      .setName('Event Type')
      .setDesc('Type of event')
      .addDropdown((dropdown) => {
        // Add event type options
        const eventTypes = [
          {value: 'TASK-TODO', name: 'To-Do'},
          {value: 'TASK-DONE', name: 'Done'},
          {value: 'TASK-IN_PROGRESS', name: 'In Progress'},
          {value: 'TASK-IMPORTANT', name: 'Important'},
        ];

        // Add options to dropdown
        eventTypes.forEach((type) => {
          dropdown.addOption(type.value, type.name);
        });

        // Set current value and handle changes
        dropdown.setValue(this.result.eventType).onChange((value) => {
          this.result.eventType = value;
        });
      });

    // All day toggle
    new Setting(formContainer)
      .setName('All Day')
      .setDesc('Is this an all-day event?')
      .addToggle((toggle) => {
        toggle.setValue(this.result.allDay).onChange((value) => {
          this.result.allDay = value;
        });
      });

    // Start time
    new Setting(formContainer)
      .setName('Start Time')
      .setDesc('When the event starts')
      .addText((text) => {
        const dateString = moment(this.result.startDate).format('YYYY-MM-DD HH:mm');
        text.setValue(dateString).onChange((value) => {
          const date = moment(value, 'YYYY-MM-DD HH:mm').toDate();
          if (!isNaN(date.getTime())) {
            this.result.startDate = date;
          }
        });
      });

    // End time
    new Setting(formContainer)
      .setName('End Time')
      .setDesc('When the event ends')
      .addText((text) => {
        const dateString = moment(this.result.endDate).format('YYYY-MM-DD HH:mm');
        text.setValue(dateString).onChange((value) => {
          const date = moment(value, 'YYYY-MM-DD HH:mm').toDate();
          if (!isNaN(date.getTime())) {
            this.result.endDate = date;
          }
        });
      });

    // Buttons container
    const buttonsContainer = contentEl.createDiv({cls: 'event-edit-buttons'});

    // Save button
    const saveButton = buttonsContainer.createEl('button', {
      text: 'Save',
      cls: 'mod-cta',
    });

    saveButton.addEventListener('click', () => {
      this.onSave(this.result);
      this.close();
    });

    // Cancel button
    const cancelButton = buttonsContainer.createEl('button', {
      text: 'Cancel',
    });

    cancelButton.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
