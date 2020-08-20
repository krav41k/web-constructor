import {ElementRef, Injectable, Renderer2, RendererFactory2} from '@angular/core';
import {CDSortableDirective} from '../directives/cd.sortable.directive';
import {ComponentsStorageService} from './components-storage.service';
import {ComponentClass} from '../../object-models/model.classes';

export interface TreeItem {
  sortableDirective: CDSortableDirective;
  sortableComponent: ComponentClass;
}

export interface RotateEvent {
  currentIndex: number;
  rotateIndex: number;
}

const distance = (rectA: ClientRect, rectB: ClientRect): number => {
  return Math.sqrt(
    Math.pow(rectB.top - rectA.top, 2) +
    Math.pow(rectB.left - rectA.left, 2)
  );
};

const hCenter = (rect: ClientRect): number => {
  return rect.left + rect.width / 2;
};

const vCenter = (rect: ClientRect): number => {
  return rect.top + rect.height / 2;
};

@Injectable()
export class TreeControlService {

  treeItemList: TreeItem[] = [];
  private clientRects: ClientRect[];
  public floatComponent;
  private selectedItem: ElementRef;

  public changeSelectedItem(el: ElementRef) {
    if (this.selectedItem !== el) {
      if (this.selectedItem) {
        this.selectedItem.nativeElement.classList.remove('selected');
      }
      el.nativeElement.classList.add('selected');
      this.selectedItem = el;
      this.floatComponent = null;
    }
  }

  public newTreeItem(directive: CDSortableDirective, component: ComponentClass) {
    const index = this.treeItemList.findIndex(item => item.sortableComponent === component);
    if (index === -1) {
      this.treeItemList.push({sortableDirective: directive, sortableComponent: component});
    } else {
      this.treeItemList[index].sortableDirective.dragStart.unsubscribe();
      this.treeItemList[index].sortableDirective.dragMove.unsubscribe();

      this.treeItemList[index].sortableDirective = directive;
      if (component === this.floatComponent) {
        this.changeSelectedItem(directive.el);
        directive.dragging = true;
      }
    }
    directive.dragStart.subscribe(() => {
      this.treeListFormation();
    });
    directive.dragMove.subscribe((event) => {
      this.detectSorting(directive, event);
    });
  }

  removeTreeItem(directive: CDSortableDirective, component) {
    this.treeItemList.filter(item => item.sortableComponent === component);
    directive.dragStart.unsubscribe();
    directive.dragMove.unsubscribe();
  }

  private treeListFormation() {
    this.clientRects = this.treeItemList.map(sortable => sortable.sortableDirective.el.nativeElement.getBoundingClientRect());
  }

  private detectSorting(directive: CDSortableDirective, event: PointerEvent) {
    const currentIndex = this.treeItemList.findIndex(item => item.sortableDirective === directive);
    const currentRect = this.clientRects[currentIndex];
    this.clientRects
      .slice()
      .sort((rectA, rectB) => distance(rectA, currentRect) - distance(rectB, currentRect))
      .filter(rect => rect !== currentRect)
      .some(rect => {
        const isHorizontal = rect.top === currentRect.top;
        const isBefore = isHorizontal ?
          rect.left < currentRect.left :
          rect.top < currentRect.top;

        const moveBack = isBefore && (isHorizontal ?
            event.clientX < hCenter(rect) :
            event.clientY < vCenter(rect)
        );

        const moveForward = !isBefore && (isHorizontal ?
            event.clientX > hCenter(rect) :
            event.clientY > vCenter(rect)
        );

        if (moveBack || moveForward) {
          const rotateIndex = this.clientRects.indexOf(rect);
          this.rotate({
            currentIndex,
            rotateIndex
          }, this.treeItemList[currentIndex], this.treeItemList[rotateIndex]);
        }
      });
  }

  private rotate(event: RotateEvent, currentComponent, rotateComponent) {
    this.floatComponent = currentComponent.sortableComponent;
    this.swapComponents(currentComponent.sortableComponent, rotateComponent.sortableComponent);
    this.treeListFormation();
    this.directiveListRotate(event, currentComponent, rotateComponent);
  }

  private directiveListRotate(event , currentComponent, rotateComponent) {
    this.treeItemList[event.currentIndex] = rotateComponent;
    this.treeItemList[event.rotateIndex] = currentComponent;
  }

  // Перемещение компонента
  swapComponents(firstComponent, secondComponent) {
    let updater = false;
    switch (true) {
      case (firstComponent.parent === secondComponent):
        console.log('case 1');
        const parentOrderIndex = secondComponent.parent.order.indexOf(secondComponent.id);

        secondComponent.order.splice(secondComponent.order.indexOf(firstComponent.id), 1);
        secondComponent.subObjectsList.delete(firstComponent.id);

        firstComponent.parent = secondComponent.parent;

        firstComponent.level = firstComponent.parent.level + 1;
        firstComponent.parent.subObjectsList.set(firstComponent.id, firstComponent);
        firstComponent.parent.order.splice(parentOrderIndex, 0, firstComponent.id);
        updater = true;
        break;

      case (secondComponent.nestedSwitch
        && secondComponent.parent !== firstComponent):
        console.log('case 2');
        firstComponent.parent.order.splice(firstComponent.parent.order.indexOf(firstComponent.id), 1);
        firstComponent.parent.subObjectsList.delete(firstComponent.id);

        firstComponent.parent.componentRef.instance.rerender().then();
        firstComponent.parent = secondComponent;

        firstComponent.level = secondComponent.level + 1;
        secondComponent.subObjectsList.set(firstComponent.id, firstComponent);
        secondComponent.order.splice(0, 0, firstComponent.id);
        updater = true;
        break;

      case (firstComponent.parent.id === secondComponent.parent.id):
        console.log('case 3');
        const firstOrderIndex = firstComponent.parent.order.indexOf(firstComponent.id);
        const secondOrderIndex = secondComponent.parent.order.indexOf(secondComponent.id);
        firstComponent.parent.order[secondOrderIndex] = firstComponent.id;
        firstComponent.parent.order[firstOrderIndex] = secondComponent.id;
        updater = true;
        break;

      case (secondComponent.nestedSwitch === undefined
        && firstComponent.level !== secondComponent.level
        && secondComponent.parent !== firstComponent):
        console.log('case 4');
        firstComponent.parent.order.splice(firstComponent.parent.order.indexOf(firstComponent.id), 1);
        firstComponent.parent.subObjectsList.delete(firstComponent.id);

        firstComponent.parent = secondComponent.parent;

        firstComponent.level = secondComponent.level;
        firstComponent.parent.subObjectsList.set(firstComponent.id, firstComponent);
        firstComponent.parent.order.splice(firstComponent.parent.order.indexOf(secondComponent.id) + 1, 0, firstComponent.id);
        updater = true;
        break;
    }
    if (updater) {
      firstComponent.parent.componentRef.instance.rerender().then();
    }
  }
}
