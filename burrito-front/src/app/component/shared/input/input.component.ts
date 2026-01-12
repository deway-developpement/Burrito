import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [NgClass, FormsModule],
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.scss'],
})
export class InputComponent {
  /** 'primary' | 'outline' | 'ghost' */
  @Input() variant: 'primary' | 'outline' | 'ghost' = 'primary';

  /** full width */
  @Input() fullWidth = false;

  /** disabled */
  @Input() disabled = false;

  /** required flag */
  @Input() required = false;

  /** input type */
  @Input() type:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'date'
    | 'search'
    | 'tel'
    | 'url' = 'text';

  /** placeholder */
  @Input() placeholder = '';

  /** name attribute */
  @Input() name = '';

  /** ngModel value binding */
  @Input() model: any;

  /** emit changes to support two-way binding on `model` */
  @Output() modelChange = new EventEmitter<any>();

  onModelChange(value: any) {
    this.model = value;
    this.modelChange.emit(value);
  }
}
