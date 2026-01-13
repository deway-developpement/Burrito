import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NgClass, NgForOf } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface SelectOption {
  label: string;
  value: string | number;
}

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
})
export class SelectComponent {
  /** 'primary' | 'outline' | 'ghost' */
  @Input() variant: 'primary' | 'outline' | 'ghost' = 'primary';

  /** full width */
  @Input() fullWidth = false;

  /** disabled */
  @Input() disabled = false;

  /** placeholder shown as first disabled option */
  @Input() placeholder = $localize`:@@select.placeholder:Select an option`;

  /** options to display */
  @Input() options: SelectOption[] = [];

  /** required flag */
  @Input() required = false;

  /** current selected value */
  @Input() value: string | number | null = null;

  /** emit when selection changes (allows [(value)] binding) */
  @Output() valueChange = new EventEmitter<string | number | null>();

  onChange(newValue: string) {
    // always emit raw string; caller can cast if needed
    this.value = newValue;
    this.valueChange.emit(newValue);
  }
}
