/**
 * @file 디자인패턴(Design Patterns) 분야 CS 퀴즈 문항 (20문항)
 * @domain quiz
 * @layer data
 * @related src/data/quiz/types.ts, src/data/quiz/index.ts
 */
import { QuizCategory, type QuizQuestion } from './types';

/** 디자인패턴(Design Patterns) 분야 단답형 문항 목록. */
export const DESIGN_PATTERN_QUESTIONS: readonly QuizQuestion[] = [
  // ── EASY 7 ──────────────────────────────────────────────────────────────
  {
    id: 'dp-01',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '애플리케이션 전체에서 인스턴스가 오직 하나만 존재하도록 보장하는 생성 패턴은?',
      en: 'Which creational pattern ensures a class has only one instance throughout the application?',
    },
    acceptedAnswers: ['싱글톤', 'singleton', 'singleton pattern'],
    explanation: {
      ko: '싱글톤 패턴은 클래스의 인스턴스를 전역에서 하나만 생성하고, 어디서든 동일 인스턴스에 접근할 수 있게 합니다.',
      en: 'The Singleton pattern restricts instantiation to one object and provides a global point of access to it.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'dp-02',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '객체 생성의 인터페이스를 정의하되, 어떤 클래스를 생성할지는 서브클래스에 위임하는 생성 패턴은?',
      en: 'Which creational pattern defines an interface for creating objects but lets subclasses decide which class to instantiate?',
    },
    acceptedAnswers: ['팩토리메서드', '팩토리 메서드', 'factory method', 'factorymethod', 'factory method pattern'],
    explanation: {
      ko: '팩토리 메서드 패턴은 객체 생성 로직을 서브클래스로 분리해 OCP를 지키면서 다형성을 활용합니다.',
      en: 'The Factory Method pattern delegates object creation to subclasses, supporting the Open/Closed Principle.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'dp-03',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '한 객체의 상태 변화를 여러 구독자 객체에게 자동으로 알리는 행위 패턴은?',
      en: 'Which behavioral pattern notifies multiple subscriber objects automatically when one object changes state?',
    },
    acceptedAnswers: ['옵저버', 'observer', 'observer pattern', '관찰자'],
    explanation: {
      ko: '옵저버 패턴은 발행-구독 관계를 구현하며, UI 이벤트 시스템이나 이벤트 버스에 광범위하게 사용됩니다.',
      en: 'The Observer pattern implements publish-subscribe and is widely used in UI event systems and event buses.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'dp-04',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '알고리즘 군을 캡슐화하고 서로 교환 가능하게 만드는 행위 패턴은?',
      en: 'Which behavioral pattern encapsulates a family of algorithms and makes them interchangeable?',
    },
    acceptedAnswers: ['전략', 'strategy', 'strategy pattern'],
    explanation: {
      ko: '전략 패턴은 컨텍스트 코드를 변경하지 않고 알고리즘을 런타임에 교체할 수 있게 해줍니다.',
      en: 'The Strategy pattern lets you swap algorithms at runtime without modifying the context.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'dp-05',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '클래스나 모듈을 수정하지 않고 확장 가능해야 한다는 SOLID 원칙의 이름은? (약어 가능)',
      en: 'What is the name of the SOLID principle stating classes should be open for extension but closed for modification? (abbreviation accepted)',
    },
    acceptedAnswers: ['개방폐쇄원칙', '개방-폐쇄 원칙', 'OCP', 'open closed principle', 'openclosedprinciple', '개방 폐쇄 원칙'],
    explanation: {
      ko: 'OCP(개방-폐쇄 원칙)는 기존 코드를 수정하지 않고 새 기능을 추가할 수 있도록 설계해야 한다는 원칙입니다.',
      en: 'OCP (Open/Closed Principle) states software entities should be extendable without modifying existing code.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'dp-06',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: 'GoF 디자인 패턴을 생성(Creational)·구조(Structural)·행위(Behavioral) 세 범주로 분류할 때 총 몇 가지 패턴이 있는가?',
      en: 'How many patterns are defined in the original GoF book across the three categories (Creational, Structural, Behavioral)?',
    },
    acceptedAnswers: ['23', '23가지', '23개'],
    explanation: {
      ko: 'GoF(Gang of Four) 책은 생성 5 + 구조 7 + 행위 11 = 총 23가지 디자인 패턴을 정의합니다.',
      en: 'The GoF book defines 23 patterns: 5 Creational + 7 Structural + 11 Behavioral.',
    },
    difficulty: 'EASY',
  },
  {
    id: 'dp-07',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '하나의 클래스는 하나의 책임만 가져야 한다는 SOLID 원칙의 이름은? (약어 가능)',
      en: 'What is the SOLID principle stating a class should have only one reason to change? (abbreviation accepted)',
    },
    acceptedAnswers: ['단일책임원칙', '단일 책임 원칙', 'SRP', 'single responsibility principle', 'singleresponsibilityprinciple'],
    explanation: {
      ko: 'SRP(단일 책임 원칙)는 하나의 클래스가 변경되는 이유가 오직 하나여야 한다고 규정합니다.',
      en: 'SRP (Single Responsibility Principle) states a class should have only one reason to change.',
    },
    difficulty: 'EASY',
  },

  // ── MEDIUM 7 ─────────────────────────────────────────────────────────────
  {
    id: 'dp-08',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '호환되지 않는 인터페이스를 가진 클래스들을 함께 동작하도록 중간에서 변환해 주는 구조 패턴은?',
      en: 'Which structural pattern converts the interface of a class into another interface expected by clients?',
    },
    acceptedAnswers: ['어댑터', 'adapter', 'adapter pattern', '래퍼', 'wrapper'],
    explanation: {
      ko: '어댑터 패턴은 기존 클래스를 재사용하면서 인터페이스를 맞춰주는 역할을 하며, Wrapper라고도 불립니다.',
      en: 'The Adapter pattern wraps an existing class to make its interface compatible with another, also called Wrapper.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'dp-09',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '객체에 동적으로 새 책임을 추가할 수 있도록 객체를 감싸는 구조 패턴은?',
      en: 'Which structural pattern attaches additional responsibilities to an object dynamically by wrapping it?',
    },
    acceptedAnswers: ['데코레이터', 'decorator', 'decorator pattern', '장식자'],
    explanation: {
      ko: '데코레이터 패턴은 서브클래싱 없이 객체 기능을 유연하게 확장하며, Java I/O 스트림이 대표적 예입니다.',
      en: 'The Decorator pattern extends object behavior flexibly without subclassing; Java I/O streams are a classic example.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'dp-10',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '복잡한 서브시스템에 단순화된 통합 인터페이스를 제공하는 구조 패턴은?',
      en: 'Which structural pattern provides a simplified interface to a complex subsystem?',
    },
    acceptedAnswers: ['퍼사드', 'facade', 'facade pattern', '파사드'],
    explanation: {
      ko: '퍼사드 패턴은 클라이언트가 서브시스템의 세부 사항을 몰라도 되도록 단일 창구를 제공합니다.',
      en: 'The Facade pattern provides a single entry point so clients need not know subsystem internals.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'dp-11',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '요청을 객체로 캡슐화해 발신자와 수신자를 분리하고, 요청을 큐에 저장하거나 취소(undo)할 수 있게 하는 행위 패턴은?',
      en: 'Which behavioral pattern encapsulates a request as an object, enabling queuing, logging, and undo operations?',
    },
    acceptedAnswers: ['커맨드', 'command', 'command pattern', '명령'],
    explanation: {
      ko: '커맨드 패턴은 요청을 객체화해 발신자와 수신자를 분리하며, undo/redo 기능 구현에 자주 사용됩니다.',
      en: 'The Command pattern encapsulates requests as objects, decoupling sender from receiver and enabling undo/redo.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'dp-12',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '상위 클래스가 알고리즘의 뼈대를 정의하고 일부 단계를 서브클래스에서 구현하도록 하는 행위 패턴은?',
      en: 'Which behavioral pattern defines the skeleton of an algorithm in the base class and defers some steps to subclasses?',
    },
    acceptedAnswers: ['템플릿메서드', '템플릿 메서드', 'template method', 'templatemethod', 'template method pattern'],
    explanation: {
      ko: '템플릿 메서드 패턴은 알고리즘의 공통 구조를 상위 클래스에 두고 변하는 부분만 서브클래스에서 오버라이드합니다.',
      en: 'The Template Method pattern fixes the algorithm skeleton in the base class and lets subclasses override variable steps.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'dp-13',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '고수준 모듈과 저수준 모듈이 모두 추상화에 의존해야 한다는 SOLID 원칙의 이름은? (약어 가능)',
      en: 'Which SOLID principle states that high-level and low-level modules should both depend on abstractions? (abbreviation accepted)',
    },
    acceptedAnswers: ['의존역전원칙', '의존 역전 원칙', 'DIP', 'dependency inversion principle', 'dependencyinversionprinciple'],
    explanation: {
      ko: 'DIP(의존 역전 원칙)는 구체 구현이 아닌 추상화(인터페이스)에 의존하도록 설계해야 한다고 규정합니다.',
      en: 'DIP (Dependency Inversion Principle) requires depending on abstractions, not concrete implementations.',
    },
    difficulty: 'MEDIUM',
  },
  {
    id: 'dp-14',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '프레임워크가 코드를 호출하는 관계를 뒤집어, 외부 컨테이너가 객체의 의존성을 주입하는 원칙/패턴의 이름은? (약어 가능)',
      en: 'What pattern/principle describes a container injecting an object\'s dependencies rather than the object creating them itself? (abbreviation accepted)',
    },
    acceptedAnswers: ['의존성주입', '의존성 주입', 'DI', 'dependency injection', 'dependencyinjection', '제어역전', 'IoC', 'inversion of control'],
    explanation: {
      ko: 'DI(의존성 주입)는 IoC(제어 역전)의 구체적 구현 방식으로, Spring·NestJS 같은 프레임워크의 핵심 메커니즘입니다.',
      en: 'DI (Dependency Injection) is a form of IoC where a container provides an object\'s dependencies, as used in Spring and NestJS.',
    },
    difficulty: 'MEDIUM',
  },

  // ── HARD 6 ───────────────────────────────────────────────────────────────
  {
    id: 'dp-15',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '다수의 유사 객체를 공유·재사용해 메모리 사용량을 줄이는 구조 패턴은? (String 인터닝·게임 파티클 시스템에 사용)',
      en: 'Which structural pattern shares many fine-grained objects to reduce memory usage, used in String interning and game particle systems?',
    },
    acceptedAnswers: ['플라이웨이트', 'flyweight', 'flyweight pattern'],
    explanation: {
      ko: '플라이웨이트 패턴은 내부 상태(공유)와 외부 상태(비공유)를 분리해 수많은 경량 객체를 효율적으로 관리합니다.',
      en: 'The Flyweight pattern separates intrinsic (shared) and extrinsic (non-shared) state to manage huge numbers of fine-grained objects efficiently.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'dp-16',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '객체의 내부 상태를 외부에 노출하지 않고 스냅샷으로 저장한 뒤 복원할 수 있게 하는 행위 패턴은?',
      en: 'Which behavioral pattern captures and externalizes an object\'s internal state without violating encapsulation, so it can be restored later?',
    },
    acceptedAnswers: ['메멘토', 'memento', 'memento pattern'],
    explanation: {
      ko: '메멘토 패턴은 undo 기능에 주로 사용되며, 캡슐화를 해치지 않고 이전 상태를 저장·복원합니다.',
      en: 'The Memento pattern enables undo functionality by capturing state into a memento object without exposing internals.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'dp-17',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '여러 객체 간의 상호 작용을 중앙 객체에 집중시켜 결합도를 낮추는 행위 패턴은? (채팅방·항공 관제 비유)',
      en: 'Which behavioral pattern centralizes communication between objects to reduce coupling? (chatroom or air traffic control analogy)',
    },
    acceptedAnswers: ['중재자', 'mediator', 'mediator pattern'],
    explanation: {
      ko: '중재자 패턴은 N:M 객체 의존 관계를 중앙 Mediator를 통해 1:N으로 단순화해 결합도를 낮춥니다.',
      en: 'The Mediator pattern simplifies N:M dependencies into 1:N by routing communication through a central mediator.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'dp-18',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '객체 구조를 순회하면서 각 원소에 새 연산을 추가할 수 있도록, 연산을 별도 클래스(방문자)에 정의하는 행위 패턴은?',
      en: 'Which behavioral pattern lets you add further operations to objects without modifying them, by separating operations into a visitor class?',
    },
    acceptedAnswers: ['비지터', 'visitor', 'visitor pattern', '방문자'],
    explanation: {
      ko: '비지터 패턴은 이중 디스패치(double dispatch)를 이용해 원소 클래스를 변경하지 않고 새 연산을 추가합니다.',
      en: 'The Visitor pattern uses double dispatch to add new operations to an object structure without changing the element classes.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'dp-19',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: '리스코프 치환 원칙(LSP)에 따르면, 자식 클래스는 항상 부모 클래스를 대체할 수 있어야 한다. 이 원칙을 위반하는 전형적 예는 Rectangle 클래스를 상속한 어떤 도형 클래스인가?',
      en: 'According to the Liskov Substitution Principle, which shape class — when it inherits from Rectangle — is the classic LSP violation example?',
    },
    acceptedAnswers: ['정사각형', 'square', 'Square'],
    explanation: {
      ko: 'Square가 Rectangle을 상속하면 setWidth/setHeight 독립 변경 계약이 깨져 LSP를 위반합니다. 정사각형-직사각형 문제라고 불립니다.',
      en: 'Square inheriting Rectangle breaks the contract of independent width/height setters, violating LSP — known as the Square-Rectangle problem.',
    },
    difficulty: 'HARD',
  },
  {
    id: 'dp-20',
    category: QuizCategory.DESIGN_PATTERN,
    prompt: {
      ko: 'MVC 패턴에서 뷰(View)와 모델(Model)이 서로를 직접 참조하지 않도록 중간에서 뷰의 상태와 커맨드를 담당하는 계층의 이름은? (MVVM 패턴 기준)',
      en: 'In the MVVM pattern, what is the layer between View and Model that holds view state and handles commands, so View and Model do not directly reference each other?',
    },
    acceptedAnswers: ['뷰모델', '뷰 모델', 'viewmodel', 'view model', 'ViewModel'],
    explanation: {
      ko: 'MVVM의 ViewModel은 View에 필요한 상태와 커맨드를 노출하며, 데이터 바인딩을 통해 View와 Model을 분리합니다.',
      en: 'In MVVM, the ViewModel exposes state and commands for the View via data binding, decoupling View from Model.',
    },
    difficulty: 'HARD',
  },
];
