interface TaskDisplayProps {
  expression: string;
}

const TaskDisplay = ({ expression }: TaskDisplayProps) => {
  return (
    <div className="flex items-center justify-center">
      <div className="font-mono-experiment text-5xl md:text-7xl font-bold tracking-wider text-foreground select-none">
        {expression}
      </div>
    </div>
  );
};

export default TaskDisplay;
