#include <mpi.h>
#include <unistd.h>
#include <cstdio>
int main(int argc, char** argv) {
    MPI_Init(&argc, &argv);
    int rank, size, total = 0;
    MPI_Comm_rank(MPI_COMM_WORLD, &rank);
    MPI_Comm_size(MPI_COMM_WORLD, &size);
    char host[256] = {};
    gethostname(host, sizeof(host) - 1);
    int value = rank + 1;
    MPI_Reduce(&value, &total, 1, MPI_INT, MPI_SUM, 0, MPI_COMM_WORLD);
    printf("MPI rank=%d/%d host=%s\n", rank, size, host);
    int ok = 1;
    if (rank == 0) {
        ok = size == 3 && total == 6;
        printf("MPI %s: ranks=%d sum=%d\n", ok ? "OK" : "FAIL", size, total);
    }
    MPI_Bcast(&ok, 1, MPI_INT, 0, MPI_COMM_WORLD);
    MPI_Finalize();
    return ok ? 0 : 1;
}
