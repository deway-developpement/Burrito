import { Component, Input } from '@angular/core';
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

  /** input type */
  @Input() type:
    | 'text'
    | 'email'
    | 'password'
    | 'number'
    | 'search'
    | 'tel'
    | 'url' = 'text';

  /** placeholder */
  @Input() placeholder = '';

  /** name attribute */
  @Input() name = '';

  /** ngModel value binding */
  @Input() model: any;
}
