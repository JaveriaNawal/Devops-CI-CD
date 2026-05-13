import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { tasksApi, Task } from "@/lib/api";
import styles from "./TasksPage.module.css";

export function TasksPage(): JSX.Element {
  const navigate = useNavigate();
  const { logout } = useAuthStore((s) => s);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await tasksApi.getAll();
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to fetch tasks", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = (): void => {
    logout();
    navigate("/login", { replace: true });
  };

  const toggleStatus = async (task: Task) => {
    const nextStatus: Task["status"] = 
      task.status === "pending" ? "in_progress" : 
      task.status === "in_progress" ? "completed" : "pending";
    
    try {
      const res = await tasksApi.update(task.id, { status: nextStatus });
      setTasks(tasks.map(t => t.id === task.id ? res.data : t));
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const deleteTask = async (id: number) => {
    if (!confirm("Delete this task?")) return;
    try {
      await tasksApi.delete(id);
      setTasks(tasks.filter(t => t.id !== id));
    } catch (err: unknown) {
      console.error("Delete failed", (err as any).message);
    }
  };

  return (
    <div className={styles.container}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarLogo}>⚡ Taskify</div>
        <nav className={styles.nav}>
          <Link to="/dashboard" className={styles.navItem}>Dashboard</Link>
          <Link to="/tasks" className={`${styles.navItem} ${styles.active}`}>My Tasks</Link>
          <a className={styles.navItem} href="#">Settings</a>
        </nav>
        <button className={styles.logoutBtn} onClick={handleLogout}>
          Sign Out
        </button>
      </aside>

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>My Tasks</h1>
            <p className={styles.subheading}>Manage your production objectives</p>
          </div>
          <button className={styles.addTaskBtn} onClick={() => alert("Add task modal logic would go here")}>
            + Create Task
          </button>
        </header>

        {loading ? (
          <div style={{ textAlign: "center", padding: "5rem" }}>Loading tasks...</div>
        ) : (
          <section className={styles.tasksGrid}>
            {tasks.length === 0 ? (
              <div style={{ color: "#64748b", textAlign: "center", gridColumn: "1/-1", padding: "4rem" }}>
                No tasks found. Create one to get started!
              </div>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className={styles.taskCard}>
                  <span className={`${styles.taskPriority} ${styles[task.priority]}`}>
                    {task.priority}
                  </span>
                  <h3 className={styles.taskTitle}>{task.title}</h3>
                  <p className={styles.taskDescription}>
                    {task.description || "No description provided."}
                  </p>
                  <div className={styles.taskFooter}>
                    <button 
                      className={styles.statusBadge}
                      onClick={() => toggleStatus(task)}
                    >
                      {task.status.replace("_", " ")}
                    </button>
                    <div className={styles.actions}>
                      <button className={styles.actionBtn} onClick={() => alert("Edit logic")}>✎</button>
                      <button 
                        className={`${styles.actionBtn} ${styles.deleteBtn}`}
                        onClick={() => deleteTask(task.id)}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}
