#include <errno.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

static volatile sig_atomic_t requested_signal = 0;

static void handle_signal(int signal_number) {
    requested_signal = signal_number;
}

static int child_exit_code(int status) {
    if (WIFEXITED(status)) {
        return WEXITSTATUS(status);
    }
    if (WIFSIGNALED(status)) {
        return 128 + WTERMSIG(status);
    }
    return 1;
}

int main(int argc, char **argv) {
    if (argc < 2 || argv[1][0] != '/') {
        fprintf(stderr, "parent guard requires an absolute executable path\n");
        return 64;
    }

    const pid_t original_parent = getppid();
    const pid_t child = fork();
    if (child < 0) {
        perror("fork");
        return 71;
    }
    if (child == 0) {
        execv(argv[1], &argv[1]);
        perror("execv");
        _exit(127);
    }

    struct sigaction action;
    action.sa_handler = handle_signal;
    sigemptyset(&action.sa_mask);
    action.sa_flags = 0;
    sigaction(SIGTERM, &action, NULL);
    sigaction(SIGINT, &action, NULL);
    sigaction(SIGHUP, &action, NULL);
    sigaction(SIGUSR1, &action, NULL);

    const struct timespec interval = { .tv_sec = 0, .tv_nsec = 100000000L };
    int termination_ticks = -1;
    for (;;) {
        int status = 0;
        const pid_t wait_result = waitpid(child, &status, WNOHANG);
        if (wait_result == child) {
            return child_exit_code(status);
        }
        if (wait_result < 0 && errno != EINTR) {
            perror("waitpid");
            kill(child, SIGKILL);
            waitpid(child, NULL, 0);
            return 71;
        }

        const int parent_is_gone = getppid() != original_parent;
        if ((parent_is_gone || requested_signal != 0) && termination_ticks < 0) {
            const int signal_to_forward = requested_signal == 0
                ? SIGTERM
                : (requested_signal == SIGUSR1 ? SIGKILL : requested_signal);
            kill(child, signal_to_forward);
            termination_ticks = 0;
        } else if (termination_ticks >= 0) {
            termination_ticks += 1;
            if (termination_ticks >= 20) {
                kill(child, SIGKILL);
            }
        }
        nanosleep(&interval, NULL);
    }
}
