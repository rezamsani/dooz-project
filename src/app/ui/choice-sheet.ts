import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { DoozIcon } from './dooz-icon';
import { TranslatePipe } from '../i18n';

export interface ChoiceOption {
  value: string;
  label: string;
  lang?: string;
  short?: string;
}

let nextSheetId = 0;

@Component({
  selector: 'app-choice-sheet',
  imports: [DoozIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="choice-trigger" [class.compact]="compact()" [attr.aria-label]="label() + ': ' + selectedLabel()"
      aria-haspopup="dialog" [attr.aria-expanded]="open" (click)="show()" #trigger>
      @if (!compact()) { <app-dooz-icon [name]="icon()" /> }
      <span [attr.lang]="selected()?.lang">{{ compact() ? selected()?.short ?? selectedLabel() : selectedLabel() }}</span>
      <app-dooz-icon class="chevron" name="chevron" />
    </button>
    <dialog #panel class="choice-panel" [attr.aria-labelledby]="titleId" (click)="onBackdrop($event)" (close)="onClose()">
      <header><strong [id]="titleId">{{ label() }}</strong><button class="close" type="button" [attr.aria-label]="'بستن' | t" (click)="panel.close()"><app-dooz-icon name="close" /></button></header>
      <div class="choices">
        @for (option of options(); track option.value) {
          <button type="button" [attr.lang]="option.lang" [attr.aria-pressed]="option.value === value()"
            (click)="choose(option.value)"><span>{{ option.label }}</span>
            @if (option.value === value()) { <app-dooz-icon name="check" /> }
          </button>
        }
      </div>
    </dialog>
  `,
  styleUrl: './choice-sheet.css',
})
export class ChoiceSheet {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly options = input.required<readonly ChoiceOption[]>();
  readonly compact = input(false);
  readonly icon = input<'sound' | 'online'>('sound');
  readonly changed = output<string>();
  protected readonly titleId = 'choice-title-' + ++nextSheetId;
  protected readonly panel = viewChild.required<ElementRef<HTMLDialogElement>>('panel');
  protected readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');
  protected open = false;

  protected selected(): ChoiceOption | undefined {
    return this.options().find(option => option.value === this.value());
  }

  protected selectedLabel(): string {
    return this.selected()?.label ?? this.label();
  }

  protected show(): void {
    const dialog = this.panel().nativeElement;
    if (dialog.open) return;
    dialog.showModal();
    this.open = true;
    dialog.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus();
  }

  protected choose(value: string): void {
    this.changed.emit(value);
    this.panel().nativeElement.close();
  }

  protected onBackdrop(event: MouseEvent): void {
    const dialog = this.panel().nativeElement;
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right ||
        event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  }

  protected onClose(): void {
    this.open = false;
    this.trigger().nativeElement.focus({ preventScroll: true });
  }
}
