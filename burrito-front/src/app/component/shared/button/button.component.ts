import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [NgClass, RouterLink],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
})
export class ButtonComponent {
  /** 'primary' | 'outline' | 'ghost' etc. */
  @Input() variant: 'primary' | 'outline' | 'ghost' = 'primary';

  /** button type (button, submit, reset) */
  @Input() type: 'button' | 'submit' | 'reset' = 'button';

  /** button size */
  @Input() size: 'small' | 'medium' = 'medium';

  /** make the button take full width if needed */
  @Input() fullWidth = false;

  /** disabled state */
  @Input() disabled = false;

  /** optional router link (ex: '/sign-in') */
  @Input() routerLink?: string | any[];
}
