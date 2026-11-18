#include <omp.h>
#include <stdio.h>
int main(void) {
    int threads = 0, sum = 0;
    #pragma omp parallel reduction(+:sum)
    {
        #pragma omp single
        threads = omp_get_num_threads();
        sum += 1;
    }
    printf("OpenMP OK: threads=%d sum=%d\n", threads, sum);
    return (threads == 2 && sum == 2) ? 0 : 1;
}
